import { mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, describe, afterEach, jest } from '@jest/globals';
import { isReadableDirectory, loadJSON } from './io.js';

describe('isReadableDirectory', () => {
  test('returns true for existing readable directory', async () => {
    const testDir = join(tmpdir(), 'test-readable-' + Date.now());
    await mkdir(testDir);
    try {
      expect(await isReadableDirectory(testDir)).toBe(true);
    } finally {
      await rm(testDir, { recursive: true });
    }
  });

  test('returns true for nested directories', async () => {
    const testDir = join(tmpdir(), 'test-nested-' + Date.now(), 'subdir', 'deep');
    await mkdir(testDir, { recursive: true });
    try {
      expect(await isReadableDirectory(testDir)).toBe(true);
    } finally {
      await rm(join(tmpdir(), 'test-nested-' + Date.now()), { recursive: true, force: true });
    }
  });

  test('returns false for a file', async () => {
    const testFile = join(tmpdir(), 'test-file-' + Date.now());
    await writeFile(testFile, 'test');
    try {
      expect(await isReadableDirectory(testFile)).toBe(false);
    } finally {
      await rm(testFile);
    }
  });

  test('returns false for non-existent path', async () => {
    expect(await isReadableDirectory('/nonexistent/path/12345')).toBe(false);
  });

  test('returns false for empty string', async () => {
    expect(await isReadableDirectory('')).toBe(false);
  });

  // Unix-only test for permissions
  test('returns false for directory without read permissions', async () => {
    if (process.platform === 'win32') {
      return; // Skip on Windows - permissions work differently
    }

    const testDir = join(tmpdir(), 'test-no-read-' + Date.now());
    await mkdir(testDir);
    try {
      await chmod(testDir, 0o000); // Remove all permissions
      expect(await isReadableDirectory(testDir)).toBe(false);
    } finally {
      await chmod(testDir, 0o755); // Restore permissions for cleanup
      await rm(testDir, { recursive: true });
    }
  });
});

describe('loadJSON', () => {
  let testFiles: string[] = [];

  afterEach(async () => {
    // Clean up any test files created
    for (const file of testFiles) {
      await rm(file, { force: true });
    }
    testFiles = [];
  });

  test('loads JSON object from local file', async () => {
    const testFile = join(tmpdir(), 'test-' + Date.now() + '.json');
    testFiles.push(testFile);
    const testData = { foo: 'bar', num: 42, nested: { key: 'value' }};
    await writeFile(testFile, JSON.stringify(testData));

    const result = await loadJSON(testFile);
    expect(result).toEqual(testData);
  });

  test('loads JSON array from local file', async () => {
    const testFile = join(tmpdir(), 'test-array-' + Date.now() + '.json');
    testFiles.push(testFile);
    const testData = [ 1, 2, 3, { name: 'test' }];
    await writeFile(testFile, JSON.stringify(testData));

    const result = await loadJSON(testFile);
    expect(result).toEqual(testData);
  });

  test('loads JSON primitive from local file', async () => {
    const testFile = join(tmpdir(), 'test-string-' + Date.now() + '.json');
    testFiles.push(testFile);
    await writeFile(testFile, JSON.stringify('hello'));

    const result = await loadJSON(testFile);
    expect(result).toBe('hello');
  });

  test('throws error for malformed JSON file', async () => {
    const testFile = join(tmpdir(), 'bad-' + Date.now() + '.json');
    testFiles.push(testFile);
    await writeFile(testFile, '{ invalid json }');

    await expect(loadJSON(testFile)).rejects.toThrow(/Unable to load JSON/);
    await expect(loadJSON(testFile)).rejects.toThrow(testFile);
  });

  test('throws error for non-existent file', async () => {
    const nonExistentFile = '/nonexistent/file-' + Date.now() + '.json';
    await expect(loadJSON(nonExistentFile)).rejects.toThrow(/Unable to load JSON/);
    await expect(loadJSON(nonExistentFile)).rejects.toThrow(nonExistentFile);
  });

  test('loads JSON from HTTPS URL', async () => {
    const testData = { remote: 'data', items: [ 1, 2, 3 ] };

    // Mock fetch
    global.fetch = jest.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(testData),
      } as Response)
    );

    const result = await loadJSON('https://example.com/data.json');
    expect(result).toEqual(testData);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/data.json');
  });

  test('throws error for failed HTTPS request with 404', async () => {
    global.fetch = jest.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    );

    await expect(loadJSON('https://example.com/missing.json'))
      .rejects.toThrow(/Unable to fetch/);
  });

  test('throws error for failed HTTPS request with 500', async () => {
    global.fetch = jest.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response)
    );

    await expect(loadJSON('https://example.com/error.json'))
      .rejects.toThrow(/Unable to fetch/);
  });

  test('throws error for network failure', async () => {
    global.fetch = jest.fn<typeof fetch>(() =>
      Promise.reject(new Error('Network error'))
    );

    await expect(loadJSON('https://example.com/network-fail.json'))
      .rejects.toThrow(/Unable to load JSON/);
  });

  test('includes source URL in error message', async () => {
    const url = 'https://example.com/test-error.json';
    global.fetch = jest.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: false,
        status: 403,
      } as Response)
    );

    await expect(loadJSON(url)).rejects.toThrow(url);
  });
});
