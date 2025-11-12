import { expect, test, beforeAll, beforeEach } from '@jest/globals';
import { S3Client, CreateBucketCommand, BucketAlreadyOwnedByYou, GetObjectCommand, HeadObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";

import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

interface SpawnAsyncResult {
  cmd: string[];
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error | undefined;
};

const spawnAsync = (cmd: string[]) => new Promise<SpawnAsyncResult>((resolve) => {
  const p = spawn(cmd[0], cmd.slice(1), { stdio: ['inherit', 'pipe', 'pipe'] });
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
      signal: signal,
      ...(failed ? { error: new Error(err) } : {}),
    };
    resolve(data);
  });
});

const createBucket = async (bucket: string) => {
  const client = new S3Client({ forcePathStyle: true });
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
  const result = await spawnAsync(['aws', 's3', 'rm', '--recursive', `s3://${bucket}`]);
  if (result.error !== undefined) {
    throw result.error;
  }
};

const syncBucket = async (bucket: string, prefix: string, source: string) => {
  const result = await spawnAsync(['aws', 's3', 'sync', source, `s3://${bucket}/${prefix}`]);
  if (result.error !== undefined) {
    throw result.error;
  }
};

const existsInBucket = async (client: S3Client, bucket: string, key: string): Promise<boolean> => {
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

const getMetadata = async (client: S3Client, bucket: string, key: string): Promise<Record<string, string>> => {
  const data = await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  return data.Metadata ?? {};
};

const getContent = async (client: S3Client, bucket: string, key: string): Promise<string> => {
  const data = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key
  }));
  return data.Body?.transformToString('utf-8') ?? '';
};

const testFile = (p: string) => readFile(path.join(__dirname, '../test-data/build-sample', p), 'utf-8');

const BUCKET_NAME = 'tinymce-docs-generate-redirects-action';
const PREFIX = 'pr-123/run-12-3';

beforeAll(async () => {
  await createBucket(BUCKET_NAME);
});

beforeEach(async () => {
  await emptyBucket(BUCKET_NAME);
  await syncBucket(BUCKET_NAME, PREFIX, path.join(__dirname, '../test-data/build-sample'));
});

test('files are as expected before applying action', async () => {
  const client = new S3Client({ forcePathStyle: true });
  expect(await existsInBucket(client, BUCKET_NAME, `${PREFIX}/docs/index.html`)).toBe(true);
  expect(await getMetadata(client, BUCKET_NAME, `${PREFIX}/docs/index.html`)).toStrictEqual({});
  expect(await getContent(client, BUCKET_NAME, `${PREFIX}/docs/index.html`)).toStrictEqual(await testFile('docs/index.html'));
  expect(await existsInBucket(client, BUCKET_NAME, `${PREFIX}/docs/tinymce/latest/index.html`)).toBe(true);
  expect(await getMetadata(client, BUCKET_NAME,  `${PREFIX}/docs/tinymce/latest/index.html`)).toStrictEqual({});
  expect(await getContent(client, BUCKET_NAME, `${PREFIX}/docs/tinymce/latest/index.html`)).toStrictEqual(await testFile('docs/tinymce/latest/index.html'));
  expect(await existsInBucket(client, BUCKET_NAME, `${PREFIX}/index.html`)).toBe(false);
  expect(await existsInBucket(client, BUCKET_NAME, `${PREFIX}/docs-4/index.html`)).toBe(false);
  expect(await existsInBucket(client, BUCKET_NAME, `${PREFIX}/docs/tinymce/8/index.html`)).toBe(false);
});