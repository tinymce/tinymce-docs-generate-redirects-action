import fs from 'node:fs/promises';

/** Check if the path given is a real readable directory */
export const isReadableDirectory = async (p: string) => {
  if (!await fs.stat(p).then((stat) => stat.isDirectory(), () => false)) {
    return false; // not a directory (or does not exist)
  }
  // check if readable
  return await fs.access(p, fs.constants.R_OK).then(() => true, () => false);
};

/** Load JSON from either a local file or a HTTPS URL */
export const loadJSON = async (source: string): Promise<unknown> => {
  try {
    if (source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error('Unable to fetch ' + source);
      }
      return response.json();
    } else {
      return JSON.parse(await fs.readFile(source, 'utf-8'));
    }
  } catch (err) {
    // Check for error-like object (more reliable than instanceof in ES modules)
    if (typeof err === 'object' && err !== null && 'message' in err) {
      throw new Error(`Unable to load JSON from "${source}": ` + (err as Error).message);
    } else {
      throw err;
    }
  }
};