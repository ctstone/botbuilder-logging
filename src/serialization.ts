import * as crypto from 'crypto';

const defaultHashAlgo = 'md5';
const defaultHashEncoding = 'hex';
const defaultContentType = 'application/octet-stream';

export interface Blob {
  data: Buffer;
  hash: string;
  contentType: string;
}

/** Return a string locator value for the blob (e.g. URL) */
export type BlobHandler = (blob: Blob) => string;

/** Serialize an object for JSON output (clean up functions, Errors, and Buffer objects) */
export function serialize(value: any, blobLocator: BlobHandler, blobs: Blob[]): any {
  // do not serialize functions
  if (typeof value === 'function') {
    return {$function: null};

  // store relevant details from error object
  } else if (value instanceof Error) {
    return {$error: { name: value.name, message: value.message, stack: value.stack }};

  // caller normalizes Buffer
  } else if (Buffer.isBuffer(value)) {
    const blob: Blob = {data: value, hash: hash(value), contentType: defaultContentType};
    const blobLocation = blobLocator(blob);
    blobs.push(blob);
    return {$blob: blobLocation};
  } else if (value && typeof value === 'object') {
    if (value.constructor.name === 'Object') {
      const clone = {};
      Object.keys(value).forEach((x) => clone[x] = serialize(value[x], blobLocator, blobs));
      return clone;
    } else if (value.constructor.name === 'Array') {
      const clone: any[] = [];
      value.forEach((val: any, i: number) => clone[i] = serialize(val, blobLocator, blobs));
      return clone;
    } else if (value.constructor.name === 'Date') {
      return value.toISOString();
    } else {
      return {$object: null};
    }
  } else {
    return value;
  }
}

export function hash(value: Buffer | string) {
  return crypto.createHash(defaultHashAlgo).update(value).digest(defaultHashEncoding);
}
