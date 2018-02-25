import * as async from 'async';

import { Callback } from './callback';
import { Blob, BlobHandler, serialize } from './serialization';

export type DocumentWriteCallback = (err?: Error) => void;
export type BlobWriteCallback = (err?: Error) => void;

export interface DocumentWriter {
  write: (op: WriteOperation, callback: DocumentWriteCallback) => void;
}

export interface BlobWriter {
  write: (blob: Blob, callback: BlobWriteCallback) => void;
  locate: (blob: Blob) => string;
}

export interface BotLogWriterOptions {
  /** Number of simultaneous writes before queueing (default: 1) */
  concurrency?: number;
}

export interface WriteOperation {
  value: any;
  blobs: Blob[];
}

export class BotLogWriter {
  private documentQueue: async.AsyncQueue<WriteOperation>;
  private blobQueue: async.AsyncQueue<Blob>;

  constructor(private documentWriter: DocumentWriter, private blobWriter: BlobWriter, private options: BotLogWriterOptions) {
    if (!options.concurrency) {
      options.concurrency = 1;
    }
    this.documentQueue = async.queue((op, next) => this.documentWriter.write(op, next), options.concurrency);
    this.blobQueue = async.queue((blob, next) => this.blobWriter ? this.blobWriter.write(blob, next) : next(null), options.concurrency);
  }

  enqueue(entry: any, callback: Callback<any>): void {
    const blobs: Blob[] = [];
    const value = serialize(entry, (blob) => this.blobWriter.locate(blob), blobs);

    async.parallel([
      (next: Callback<void>) => this.documentQueue.push({ value, blobs }, callback),
      (next: Callback<void>) => async.each(blobs, (blob, next) => this.blobQueue.push(blob, next), next),
    ], callback);
  }
}
