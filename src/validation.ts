export interface Redirect {
  location: string;
  pattern?: string;
  redirect: string;
}

/** Check if a value is a Redirect object */
export const isRedirect = (v: unknown): v is Redirect => (
  typeof v === 'object' && v != null &&
  'location' in v && typeof v.location === 'string' &&
  'redirect' in v && typeof v.redirect === 'string' &&
  (!('pattern' in v) || typeof v.pattern === 'string')
);

/** Check S3's rules for bucket naming */
export const isValidGeneralPurposeBucketName = (bucket: string) => {
  // See rules here:
  // https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html#general-purpose-bucket-names
  return !(
    // Bucket names must be between 3 (min) and 63 (max) characters long.
    // Bucket names can consist only of lowercase letters, numbers, periods (.), and hyphens (-).
    // Bucket names must begin and end with a letter or number.
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    // Bucket names must not contain two adjacent periods.
    /\.\./.test(bucket) ||
    // Bucket names must not be formatted as an IP address (for example, 192.168.5.4).
    /^\d+\.\d+\.\d+\.\d+$/.test(bucket) ||
    // Bucket names must not start with the prefix xn--.
    /^xn--/.test(bucket) ||
    // Bucket names must not start with the prefix sthree-.
    /^sthree-/.test(bucket) ||
    // Bucket names must not start with the prefix amzn-s3-demo-.
    /^amzn-s3-demo-/.test(bucket) ||
    // Bucket names must not end with the suffix -s3alias. This suffix is reserved for access point alias names.
    /-s3alias$/.test(bucket) ||
    // Bucket names must not end with the suffix --ol-s3. This suffix is reserved for Object Lambda Access Point alias names.
    /--ol-s3$/.test(bucket) ||
    // Bucket names must not end with the suffix .mrap. This suffix is reserved for Multi-Region Access Point names.
    /\.mrap$/.test(bucket) ||
    // Bucket names must not end with the suffix --x-s3. This suffix is reserved for directory buckets.
    /--x-s3$/.test(bucket) ||
    // Bucket names must not end with the suffix --table-s3. This suffix is reserved for S3 Tables buckets.
    /--table-s3$/.test(bucket)
  );
};

/** Check if a prefix is valid */
export const isValidPrefix = (prefix: string) => {
  return /^[a-z0-9.-]+(\/[a-z0-9.-]+)*$/.test(prefix);
};