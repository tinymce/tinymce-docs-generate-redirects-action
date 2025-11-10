import * as core from "@actions/core";

import {
  PutObjectCommand,
  CopyObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import fs from 'node:fs';
import path from 'node:path';

/**
 * Check if an S3 object exists
 */
const checkS3ObjectExists = async (buildPath, _client, _bucket, _prefix, subPath) => {
  // it's too slow to talk to s3, so just check the local files we just uploaded...
  return fs.existsSync(path.join(buildPath, subPath));
}

/**
 * 
 * @param {S3Client} client 
 * @param {string} bucket 
 * @param {string} prefix 
 * @param {string} subPath 
 * @param {Record<string, string>} metadata 
 * @returns {Promise<{ copied: boolean, subPath: string, error?: S3ServiceException}>}
 */
const copyS3ObjectWithMetadataAsync = async (client, bucket, prefix, subPath, metadata) => {
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
 * 
 * @param {S3Client} client 
 * @param {string} bucket 
 * @param {string} prefix 
 * @param {string} subPath 
 * @param {Record<string, string>} metadata 
 * @returns {Promise<{ copied: boolean, subPath: string, error?: S3ServiceException}>}
 */
const createNewS3ObjectAsync = async (client, bucket, prefix, subPath, metadata) => {
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
}

/**
 * 
 * @param {string} buildPath
 * @param {S3Client} client 
 * @param {string} bucket 
 * @param {string} prefix 
 * @param {string} subPath 
 * @param {Record<string, string>} metadata 
 * @returns 
 */
const createOrUpdateS3ObjectAsync = async (buildPath, client, bucket, prefix, subPath, metadata) => {
  // Check if object already exists
  if (await checkS3ObjectExists(buildPath, client, bucket, prefix, subPath)) {
    return copyS3ObjectWithMetadataAsync(client, bucket, prefix, subPath, metadata);
  } else {
    return createNewS3ObjectAsync(client, bucket, prefix, subPath, metadata);
  }
}

/**
 * Important: do not make this an async generator as that means it can only 
 * produce one value at a time. It must instead be a normal generator that 
 * returns promises.
 * 
 * @param {string} buildPath
 * @param {S3Client} client 
 * @param {string} bucket 
 * @param {string} prefix 
 * @param {Map<string, string>} redirectsByLocation 
 */
function* generateRedirectObjectsAsync(buildPath, client, bucket, prefix, redirectsByLocation) {
  for (const [location, locationRedirects] of redirectsByLocation) {
    // Create S3 object path by appending index.html to location
    const locationIndexHtml = location.endsWith('/')
      ? `${location}index.html`
      : `${location}/index.html`;

    // Remove leading slash from location
    const subPath = locationIndexHtml.startsWith('/') ? locationIndexHtml.slice(1) : locationIndexHtml;

    // Build metadata headers
    const metadata = {};

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
 * @template T
 * @param {number} max 
 * @param {Generator<Promise<T>, void, unknown>} source 
 * @returns {AsyncGenerator<T, void, unknown>}
 */
async function* parallelGenerator(max, source) {
  /**
   * @param {number} i
   * @param {IteratorResult<Promise<T>, void>} task 
   * @returns {Promise<[number, IteratorResult<T>]>}
   */
  const wrap = (i, task) => new Promise((resolve) => {
    if (task.done) {
      resolve([i, { done: true }]);
    } else {
      task.value.then((v) => resolve([i, { done: false, value: v }]))
    }
  })
  /** @type {(Promise<[number, IteratorResult<T, void>]>)[]} */
  let tasks = [];
  for (let i = 0; i < max; i++) {
    tasks.push(wrap(i, source.next()))
  }
  /** @type {(Promise<[number, IteratorResult<T, void>]> | null)[]} */
  let tasksAndNull;
  while (true) {
    const [i, v] = await Promise.race(tasks);
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
    const [i, v] = await Promise.race(filteredTasks);
    tasksAndNull[i] = null;
    if (!v.done) {
      yield v.value;
    }
    filteredTasks = tasksAndNull.filter((v) => v !== null);
  }
}

/**
 *  
 * @param {string} buildPath
 * @param {string} bucket 
 * @param {string} prefix 
 * @param {number} parallel
 * @param {{location: string, pattern?: string, redirect: string}[]} redirects
 */
const makeRedirectObjects = async (buildPath, bucket, prefix, parallel, redirects) => {
  let successCount = 0;
  let errorCount = 0;
  // Group redirects by location to handle multiple redirects for the same location
  /** @type {Map<string, {location: string, pattern?: string, redirect: string}[]>} */
  const redirectsByLocation = new Map();

  redirects.forEach((redirect) => {
    const location = redirect.location;
    if (!redirectsByLocation.has(location)) {
      redirectsByLocation.set(location, []);
    }
    redirectsByLocation.get(location).push(redirect);
  });

  const client = new S3Client({});

  const tasks = parallelGenerator(parallel, generateRedirectObjectsAsync(buildPath, client, bucket, prefix, redirectsByLocation));
  let processedCount = 0;
  for await (const taskResult of tasks) {
    const { subPath, error, copied } = taskResult;
    processedCount++;
    core.info(`Processed ${((processedCount / redirectsByLocation.size) * 100).toFixed(1)}%: ${taskResult.subPath}`);
    if (error) {
      errorCount++;
      core.error(`Error ${copied ? 'Updating' : 'Creating'} S3 object ${prefix}/${subPath}: ${error.message}`);
    } else {
      successCount++;
    }
  }
  core.info(`Finished with ${errorCount} error(s)`);
};

const main = async () => {
  console.log('Getting input build');
  core.debug('Getting input build');
  const buildPath = core.getInput('build');
  console.log('Got input build: ' + buildPath);
  core.debug('Got input build: ' + buildPath);

  console.log('Getting input redirects');
  core.debug('Getting input redirects');
  const redirectsPath = core.getInput('redirects');
  console.log('Got input redirects: ' + redirectsPath);
  core.debug('Got input redirects: ' + redirectsPath);

  console.log('Loading file redirects: ' + path.resolve(redirectsPath));
  core.debug('Loading file redirects: ' + path.resolve(redirectsPath));
  /**
   * @type {{location: string, pattern?: string, redirect: string}[]}
   */
  const redirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf-8'));

  console.log('Got redirects: ' + redirects.length);
  core.debug('Got redirects: ' + redirects.length);

  console.log('Getting input bucket');
  core.debug('Getting input bucket');
  const bucket = core.getInput('bucket');
  console.log('Got input bucket: ' + bucket);
  core.debug('Got input bucket: ' + bucket);


  if (!/^[a-z0-9][a-z0-9\.-]{1,61}[a-z0-9]$/.test(bucket) ||
    /\.\./.test(bucket) || /^\d+\.\d+\.\d+\.\d+$/.test(bucket) ||
    /^xn--/.test(bucket) || /^sthree-/.test(bucket) || /^amzn-s3-demo-/.test(bucket) ||
    /-s3alias$/.test(bucket) || /--ol-s3$/.test(bucket) || /\.mrap$/.test(bucket) ||
    /--x-s3$/.test(bucket) || /--table-s3$/.test(bucket)) {
    console.error('Bucket was invalid');
    core.error('Bucket was invalid');
    return Promise.reject(`Invalid bucket name, got ${bucket}`);
  }

  console.log('Getting input prefix');
  core.debug('Getting input prefix');
  const prefix = core.getInput('prefix');
  console.log('Got input prefix: ' + prefix);
  core.debug('Got input prefix: ' + prefix);
  if (!/^[a-z0-9\.-]+(\/[a-z0-9\.-]+)*$/.test(prefix)) {
    console.error('Prefix was invalid');
    core.error('Prefix was invalid');
    return Promise.reject(`Invalid prefix, got ${prefix}`);
  }

  console.log('Getting input parallel');
  core.debug('Getting input parallel');
  const parallel = parseInt(core.getInput('parallel'), 10);
  console.log('Got input parallel: ' + parallel);
  core.debug('Got input parallel: ' + parallel);
  if (Number.isNaN(parallel)) {
    console.error('Parallel was invalid');
    core.error('Parallel was invalid');
    return Promise.reject(`Invalid integer value for parallel, got ${core.getInput('parallel')}`);
  }

  console.log('About to make redirects');
  core.debug('About to make redirects');
  await makeRedirectObjects(buildPath, bucket, prefix, parallel, redirects);
  console.log('Finished making redirects');
  core.debug('Finished making redirects');
};

export const run = async () => {
  console.log('Starting run');
  core.debug('Starting run');
  try {
    await main();
  } catch (err) {
    if (typeof err === 'string' || err instanceof Error) {
      core.setFailed(err);
    } else {
      core.setFailed(err !== undefined ? String(err) : 'unknown error')
    }
  }
};
