
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { S3Client, CreateBucketCommand, BucketAlreadyOwnedByYou, GetObjectCommand, HeadObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { expect, test, beforeAll, beforeEach } from '@jest/globals';

interface SpawnAsyncResult {
  cmd: string[];
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error | undefined;
};

const spawnAsync = (cmd: string[]) => new Promise<SpawnAsyncResult>((resolve) => {
  const p = spawn(cmd[0], cmd.slice(1), { stdio: [ 'inherit', 'pipe', 'pipe' ] });
  p.stdout.setEncoding('utf-8');
  let out = '';
  let err = '';
  p.stdout.on('data', (chunk) => {
    out += chunk;
  });
  p.stderr.on('data', (chunk) => {
    err += chunk;
  });
  p.on('exit', (code, signal) => {
    const failed = code !== 0 || signal;
    const data = {
      cmd,
      stdout: out,
      stderr: err,
      status: code,
      signal,
      ...(failed ? { error: new Error(err) } : {}),
    };
    resolve(data);
  });
});

const createBucket = async (client: S3Client, bucket: string) => {
  try {
    await client.send(new CreateBucketCommand({
      Bucket: bucket
    }));
  } catch (err) {
    if (err instanceof BucketAlreadyOwnedByYou) {
      // ignore
    } else {
      throw err;
    }
  }
};

const emptyBucket = async (bucket: string) => {
  const result = await spawnAsync([ 'aws', 's3', 'rm', '--recursive', `s3://${bucket}` ]);
  if (result.error !== undefined) {
    throw result.error;
  }
};

const syncBucket = async (bucket: string, prefix: string, source: string) => {
  const result = await spawnAsync([ 'aws', 's3', 'sync', source, `s3://${bucket}/${prefix}` ]);
  if (result.error !== undefined) {
    throw result.error;
  }
};

const runAction = async () => {
  const result = await spawnAsync([ 'npx', '@github/local-action', '/workspace', 'src/main.ts', 'test-data/.env' ]);
  if (result.error !== undefined) {
    throw result.error;
  }
};

const existsInBucket = async (client: S3Client, bucket: string, prefix: string, subpath: string): Promise<boolean> => {
  const key = `${prefix}/${subpath}`;
  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    return true;
  } catch (err) {
    if (err instanceof S3ServiceException) {
      if (err.name === 'NotFound') {
        return false;
      }
    }
    throw err;
  }
};

const getMetadata = async (client: S3Client, bucket: string, prefix: string, subpath: string): Promise<Record<string, string>> => {
  const key = `${prefix}/${subpath}`;
  const data = await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  return data.Metadata ?? {};
};

const getContent = async (client: S3Client, bucket: string, prefix: string, subpath: string): Promise<string> => {
  const key = `${prefix}/${subpath}`;
  const data = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  return data.Body?.transformToString('utf-8') ?? '';
};

const inputContent = (p: string) => readFile(path.join(__dirname, '../test-data/build-sample', p), 'utf-8');

// names
const BUCKET_NAME = 'tinymce-docs-generate-redirects-action';
const PREFIX = 'pr-123/run-12-3';
const EMPTY_HTML = '<!doctype html><title>?</title>';

// File data
const INPUT_1 = 'docs/index.html';
const INPUT_2 = 'docs/tinymce/latest/index.html';
const OUTPUT_1 = 'index.html';
const OUTPUT_2 = 'docs-4x/index.html';
const OUTPUT_3 = 'docs/tinymce/8/index.html';
const INPUT_1_META = {
  'redirect-location-1': '/docs/tinymce/latest/'
};
const OUTPUT_1_META = {
  'redirect-failure': 'not-found',
  'redirect-location-1': '/docs%1',
  'redirect-location-2': '/docs%1',
  'redirect-pattern-1': '^/docs%-beta(.*)$',
  'redirect-pattern-2': '^/docs%-preview(.*)$',
};
const OUTPUT_2_META = {
  'redirect-failure': 'not-found',
  'redirect-location-1': '/docs/tinymce/latest/',
};
const OUTPUT_3_META = {
  'redirect-failure': 'not-found',
  'redirect-location-1': '/docs/tinymce/latest/%1',
  'redirect-pattern-1': '^/docs/tinymce/8/(.*)$',
};

// client
const s3client = new S3Client({ forcePathStyle: true });

beforeAll(async () => {
  if (process.env.AWS_ENDPOINT_URL !== 'http://s3:9000') {
    throw new Error('Warning: the tests must be run inside the devcontainer!');
  }
  await createBucket(s3client, BUCKET_NAME);
});

beforeEach(async () => {
  await emptyBucket(BUCKET_NAME);
  await syncBucket(BUCKET_NAME, PREFIX, path.join(__dirname, '../test-data/build-sample'));
});

test('files are as expected before running action', async () => {
  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toStrictEqual({});
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toStrictEqual(await inputContent(INPUT_1));

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toStrictEqual({});
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toStrictEqual(await inputContent(INPUT_2));

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_1)).toBe(false);
  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_2)).toBe(false);
  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_3)).toBe(false);
});

test('files are as expected after running action', async () => {
  await runAction();

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toStrictEqual(INPUT_1_META);
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, INPUT_1)).toStrictEqual(await inputContent(INPUT_1));

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toStrictEqual({});
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, INPUT_2)).toStrictEqual(await inputContent(INPUT_2));

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_1)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, OUTPUT_1)).toStrictEqual(OUTPUT_1_META);
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, OUTPUT_1)).toStrictEqual(EMPTY_HTML);

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_2)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, OUTPUT_2)).toStrictEqual(OUTPUT_2_META);
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, OUTPUT_2)).toStrictEqual(EMPTY_HTML);

  expect(await existsInBucket(s3client, BUCKET_NAME, PREFIX, OUTPUT_3)).toBe(true);
  expect(await getMetadata(s3client, BUCKET_NAME, PREFIX, OUTPUT_3)).toStrictEqual(OUTPUT_3_META);
  expect(await getContent(s3client, BUCKET_NAME, PREFIX, OUTPUT_3)).toStrictEqual(EMPTY_HTML);
});