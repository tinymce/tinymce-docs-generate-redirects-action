import fs from 'node:fs/promises';
import path from 'node:path';
import * as core from '@actions/core';

import {
  PutObjectCommand,
  CopyObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

interface S3Operation {
  copied: boolean;
  subPath: string;
  error?: S3ServiceException;
}

interface Redirect {
  location: string;
  pattern?: string;
  redirect: string;
}

/**
 * Check if an S3 object exists
 */
const checkS3ObjectExists = async (buildPath: string, _client: S3Client, _bucket: string, _prefix: string, subPath: string): Promise<boolean> => {
  // it's too slow to talk to s3, so just check the local files we just uploaded...
  return fs.access(path.join(buildPath, subPath), fs.constants.F_OK).then(() => true, () => false);
};

/**
 * Copy an object to itself while replacing the metadata.
 */
const copyS3ObjectWithMetadataAsync = async (
  client: S3Client,
  bucket: string,
  prefix: string,
  subPath: string,
  metadata: Record<string, string>
): Promise<S3Operation> => {
  const copied = true;
  const fullPath = `${prefix}/${subPath}`;
  const command = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${fullPath}`,
    Key: fullPath,
    MetadataDirective: 'REPLACE',
    ContentType: 'text/html',
    Metadata: metadata
  });
  try {
    await client.send(command);
    return { copied, subPath };
  } catch (error) {
    if (error instanceof S3ServiceException) {
      return { copied, subPath, error };
    } else {
      throw error;
    }
  }
};

/**
 * Create a object containing an HTML file with metadata.
 */
const createNewS3ObjectAsync = async (
  client: S3Client,
  bucket: string,
  prefix: string,
  subPath: string,
  metadata: Record<string, string>
): Promise<S3Operation> => {
  const copied = false;
  const fullPath = `${prefix}/${subPath}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fullPath,
    Body: '<!doctype html><title>?</title>',
    ContentType: 'text/html',
    Metadata: { ...metadata, 'redirect-failure': 'not-found' }
  });
  try {
    await client.send(command);
    return { copied, subPath };
  } catch (error) {
    if (error instanceof S3ServiceException) {
      return { copied, subPath, error };
    } else {
      throw error;
    }
  }
};

/**
 * Setup an object with metadata.
 */
const createOrUpdateS3ObjectAsync = async (
  buildPath: string,
  client: S3Client,
  bucket: string,
  prefix: string,
  subPath: string,
  metadata: Record<string, string>
): Promise<S3Operation> => {
  // Check if object already exists
  if (await checkS3ObjectExists(buildPath, client, bucket, prefix, subPath)) {
    return copyS3ObjectWithMetadataAsync(client, bucket, prefix, subPath, metadata);
  } else {
    return createNewS3ObjectAsync(client, bucket, prefix, subPath, metadata);
  }
};

/**
 * Important: do not make this an async generator as that means it can only
 * produce one value at a time. It must instead be a normal generator that
 * returns promises.
 */
function* generateRedirectObjectsAsync(
  buildPath: string,
  client: S3Client,
  bucket: string,
  prefix: string,
  redirectsByLocation: Map<string, Redirect[]>
): Generator<Promise<S3Operation>, void, unknown> {
  for (const [ location, locationRedirects ] of redirectsByLocation) {
    // Create S3 object path by appending index.html to location
    const locationIndexHtml = location.endsWith('/')
      ? `${location}index.html`
      : `${location}/index.html`;

    // Remove leading slash from location
    const subPath = locationIndexHtml.startsWith('/') ? locationIndexHtml.slice(1) : locationIndexHtml;

    // Build metadata headers
    const metadata: Record<string, string> = {};

    locationRedirects.forEach((redirect, index) => {
      const i = index + 1; // 1-based indexing as requested

      // Add redirect location header
      metadata[`redirect-location-${i}`] = redirect.redirect;

      // Add pattern header if it exists
      if (redirect.pattern !== undefined) {
        metadata[`redirect-pattern-${i}`] = redirect.pattern;
      }
    });

    // Create or update the S3 object
    yield createOrUpdateS3ObjectAsync(buildPath, client, bucket, prefix, subPath, metadata);
  }
}

/**
 * This takes in a normal generator that returns promises and returns an async
 * generator that runs `max` of those promises in parallel to improve throughput.
 */
async function* parallelGenerator<T>(max: number, source: Generator<Promise<T>, void, unknown>): AsyncGenerator<T, void, unknown> {
  const wrap = (i: number, task: IteratorResult<Promise<T>, void>): Promise<[number, IteratorResult<T>]> => new Promise((resolve) => {
    if (task.done) {
      resolve([ i, { done: true, value: undefined }]);
    } else {
      task.value.then((v) => resolve([ i, { done: false, value: v }]));
    }
  });
  const tasks: (Promise<[number, IteratorResult<T, void>]>)[] = [];
  for (let i = 0; i < max; i++) {
    tasks.push(wrap(i, source.next()));
  }
  let tasksAndNull: (Promise<[number, IteratorResult<T, void>]> | null)[];
  while (true) {
    const [ i, v ] = await Promise.race(tasks);
    if (v.done) {
      // move the tasks over to the nullable list
      tasksAndNull = tasks.splice(0, tasks.length);
      tasksAndNull[i] = null;
      break;
    } else {
      tasks[i] = wrap(i, source.next());
      yield v.value;
    }
  }
  let filteredTasks = tasksAndNull.filter((v) => v !== null);
  while (filteredTasks.length > 0) {
    const [ i, v ] = await Promise.race(filteredTasks);
    tasksAndNull[i] = null;
    if (!v.done) {
      yield v.value;
    }
    filteredTasks = tasksAndNull.filter((t) => t !== null);
  }
}

/**
 * Make objects representing all the redirects.
 */
const makeRedirectObjects = async (buildPath: string, bucket: string, prefix: string, parallel: number, redirects: Redirect[]): Promise<void> => {
  let errorCount = 0;
  // Group redirects by location to handle multiple redirects for the same location
  const redirectsByLocation: Map<string, Redirect[]> = new Map();

  redirects.forEach((redirect) => {
    const location = redirect.location;
    if (!redirectsByLocation.has(location)) {
      redirectsByLocation.set(location, []);
    }
    redirectsByLocation.get(location)?.push(redirect);
  });

  const client = new S3Client({ forcePathStyle: true });

  const tasks = parallelGenerator(parallel, generateRedirectObjectsAsync(buildPath, client, bucket, prefix, redirectsByLocation));
  let processedCount = 0;
  for await (const taskResult of tasks) {
    const { subPath, error, copied } = taskResult;
    processedCount++;
    core.info(`Processed ${((processedCount / redirectsByLocation.size) * 100).toFixed(1)}%: ${subPath}`);
    if (error) {
      errorCount++;
      core.error(`Error ${copied ? 'Updating' : 'Creating'} S3 object ${prefix}/${subPath}: ${error.message}`);
    }
  }
  core.info(`Finished with ${errorCount} error(s)`);
};

/**
 * Get inputs from github and create redirects.
 */
const main = async (): Promise<void> => {
  const buildPath = core.getInput('build');
  core.debug(`Got input build "${buildPath}" which resolves to "${path.resolve(buildPath)}"`);

  const redirectsSource = core.getInput('redirects');
  core.debug(`Got input redirects "${redirectsSource}"`);

  const redirects: Redirect[] = await (async () => {
    if (redirectsSource.startsWith('https://')) {
      const response = await fetch(redirectsSource);
      if (!response.ok) {
        throw new Error('Unable to fetch ' + redirectsSource);
      }
      return response.json();
    } else {
      return JSON.parse(await fs.readFile(redirectsSource, 'utf-8'));
    }
  })();
  if (!(Array.isArray(redirects) && redirects.every((v) => (
    typeof v === 'object' && typeof v.location === 'string' &&
    typeof v.redirect === 'string' &&
    (typeof v.pattern === 'undefined' || typeof v.pattern === 'string')
  )))) {
    throw new Error(`Invalid redirects data`);
  }

  const bucket = core.getInput('bucket');
  core.debug(`Got input bucket "${bucket}"`);
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    /\.\./.test(bucket) || /^\d+\.\d+\.\d+\.\d+$/.test(bucket) ||
    /^xn--/.test(bucket) || /^sthree-/.test(bucket) || /^amzn-s3-demo-/.test(bucket) ||
    /-s3alias$/.test(bucket) || /--ol-s3$/.test(bucket) || /\.mrap$/.test(bucket) ||
    /--x-s3$/.test(bucket) || /--table-s3$/.test(bucket)) {
    throw new Error(`Invalid bucket name, got ${bucket}`);
  }

  const prefix = core.getInput('prefix');
  core.debug(`Got input prefix "${prefix}"`);
  if (!/^[a-z0-9.-]+(\/[a-z0-9.-]+)*$/.test(prefix)) {
    throw new Error(`Invalid prefix, got ${prefix}`);
  }

  const parallel = parseInt(core.getInput('parallel'), 10);
  core.debug(`Got input parallel ${parallel}`);
  if (Number.isNaN(parallel)) {
    throw new Error(`Invalid integer value for parallel, got ${core.getInput('parallel')}`);
  }

  await makeRedirectObjects(buildPath, bucket, prefix, parallel, redirects);
};

/**
 * Run the action and report errors.
 */
export const run = async () => {
  core.debug('Starting tinymce-docs-generate-redirects-action');
  try {
    await main();
  } catch (err) {
    if (typeof err === 'string' || err instanceof Error) {
      core.setFailed(err);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      core.setFailed(err !== undefined ? String(err) : 'unknown error');
    }
  }
};
