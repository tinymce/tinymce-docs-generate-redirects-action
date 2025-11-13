import { expect, test } from '@jest/globals';
import { isValidGeneralPurposeBucketName, isRedirect, isValidPrefix } from './validation.js';

test('test isValidGeneralPurposeBucketName', () => {
  // Bucket names must be between 3 (min) and 63 (max) characters long.
  expect(isValidGeneralPurposeBucketName('')).toBe(false);
  expect(isValidGeneralPurposeBucketName('a')).toBe(false);
  expect(isValidGeneralPurposeBucketName('aa')).toBe(false);
  expect(isValidGeneralPurposeBucketName(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
  // Bucket names can consist only of lowercase letters, numbers, periods (.), and hyphens (-).
  expect(isValidGeneralPurposeBucketName('AAA')).toBe(false);
  expect(isValidGeneralPurposeBucketName('Hello World')).toBe(false);
  expect(isValidGeneralPurposeBucketName('url%20encoded')).toBe(false);
  expect(isValidGeneralPurposeBucketName('ùɳіɕөɗє')).toBe(false);
  // Bucket names must begin and end with a letter or number.
  expect(isValidGeneralPurposeBucketName('.aaa')).toBe(false);
  expect(isValidGeneralPurposeBucketName('aaa.')).toBe(false);
  expect(isValidGeneralPurposeBucketName('-aaa')).toBe(false);
  expect(isValidGeneralPurposeBucketName('aaa-')).toBe(false);
  // Bucket names must not contain two adjacent periods.
  expect(isValidGeneralPurposeBucketName('a..b')).toBe(false);
  // Bucket names must not be formatted as an IP address (for example, 192.168.5.4).
  expect(isValidGeneralPurposeBucketName('192.168.5.4')).toBe(false);
  // Bucket names must not start with the prefix xn--.
  expect(isValidGeneralPurposeBucketName('xn--mnchen-3ya.de')).toBe(false);
  // Bucket names must not start with the prefix sthree-.
  expect(isValidGeneralPurposeBucketName('sthree-po')).toBe(false);
  // Bucket names must not start with the prefix amzn-s3-demo-.
  expect(isValidGeneralPurposeBucketName('amzn-s3-demo-thing')).toBe(false);
  // Bucket names must not end with the suffix -s3alias. This suffix is reserved for access point alias names.
  expect(isValidGeneralPurposeBucketName('thing-s3alias')).toBe(false);
  // Bucket names must not end with the suffix --ol-s3. This suffix is reserved for Object Lambda Access Point alias names.
  expect(isValidGeneralPurposeBucketName('thing--ol-s3')).toBe(false);
  // Bucket names must not end with the suffix .mrap. This suffix is reserved for Multi-Region Access Point names.
  expect(isValidGeneralPurposeBucketName('thing.mrap')).toBe(false);
  // Bucket names must not end with the suffix --x-s3. This suffix is reserved for directory buckets.
  expect(isValidGeneralPurposeBucketName('thing--x-s3')).toBe(false);
  // Bucket names must not end with the suffix --table-s3. This suffix is reserved for S3 Tables buckets.
  expect(isValidGeneralPurposeBucketName('thing--table-s3')).toBe(false);
  // some valid values
  expect(isValidGeneralPurposeBucketName('the-quick-brown-fox-jumps-over-the-lazy-dog')).toBe(true);
  expect(isValidGeneralPurposeBucketName('using.dots.as.a.separator')).toBe(true);
  expect(isValidGeneralPurposeBucketName('one-1.two-2.three-3')).toBe(true);
});

test('test isRedirect', () => {
  // Valid redirect objects
  expect(isRedirect({
    location: '/old-path',
    redirect: '/new-path'
  })).toBe(true);

  expect(isRedirect({
    location: '/old-path',
    redirect: '/new-path',
    pattern: '^/old-path$'
  })).toBe(true);

  // Invalid - missing required fields
  expect(isRedirect({})).toBe(false);
  expect(isRedirect({ location: '/path' })).toBe(false);
  expect(isRedirect({ redirect: '/path' })).toBe(false);

  // Invalid - wrong types
  expect(isRedirect({
    location: 123,
    redirect: '/new-path'
  })).toBe(false);

  expect(isRedirect({
    location: '/old-path',
    redirect: 456
  })).toBe(false);

  expect(isRedirect({
    location: '/old-path',
    redirect: '/new-path',
    pattern: 789
  })).toBe(false);

  // Invalid - null/undefined
  expect(isRedirect(null)).toBe(false);
  expect(isRedirect(undefined)).toBe(false);

  // Invalid - primitives
  expect(isRedirect('string')).toBe(false);
  expect(isRedirect(123)).toBe(false);
  expect(isRedirect(true)).toBe(false);

  // Invalid - arrays
  expect(isRedirect([])).toBe(false);
  expect(isRedirect([{ location: '/path', redirect: '/new' }])).toBe(false);
});

test('test isValidPrefix', () => {
  // Valid prefixes
  expect(isValidPrefix('docs')).toBe(true);
  expect(isValidPrefix('docs/v5')).toBe(true);
  expect(isValidPrefix('docs/v5/api')).toBe(true);
  expect(isValidPrefix('my-docs')).toBe(true);
  expect(isValidPrefix('docs.old')).toBe(true);
  expect(isValidPrefix('v1.2.3')).toBe(true);
  expect(isValidPrefix('prefix-123/subdir-456')).toBe(true);

  // Invalid - uppercase
  expect(isValidPrefix('Docs')).toBe(false);
  expect(isValidPrefix('DOCS')).toBe(false);

  // Invalid - special characters
  expect(isValidPrefix('docs/with space')).toBe(false);
  expect(isValidPrefix('docs_underscore')).toBe(false);
  expect(isValidPrefix('docs@special')).toBe(false);
  expect(isValidPrefix('docs#hash')).toBe(false);

  // Invalid - leading/trailing slashes
  expect(isValidPrefix('/docs')).toBe(false);
  expect(isValidPrefix('docs/')).toBe(false);
  expect(isValidPrefix('/docs/')).toBe(false);

  // Invalid - double slashes
  expect(isValidPrefix('docs//api')).toBe(false);

  // Invalid - empty
  expect(isValidPrefix('')).toBe(false);

  // Invalid - only slash
  expect(isValidPrefix('/')).toBe(false);
});