import * as async from 'async';
import { Activity, ConversationReference, Intent } from 'botbuilder';

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

export interface LogEntry {
  request: Partial<Activity>;
  responses: Array<Partial<Activity>>;
  responded: boolean;
  conversation: Partial<ConversationReference>;
  state: BotState;
  topIntent: Intent;
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

  // TODO are there other objects that should be logged besides BotContext?
  enqueue(context: BotContext, callback: Callback<any>): void {
    // map the relevant fields from context
    // TODO: are there more than these?
    const logEntry: LogEntry = {
      request: context.request,
      responses: context.responses,
      responded: context.responded,
      conversation: context.conversationReference,
      state: context.state,
      topIntent: context.topIntent,
    };

    const blobs: Blob[] = [];
    const value = serialize(logEntry, (blob) => this.blobWriter.locate(blob), blobs);

    async.parallel([
      (next: Callback<void>) => this.documentQueue.push({ value, blobs }, callback),
      (next: Callback<void>) => async.each(blobs, (blob, next) => this.blobQueue.push(blob, next), next),
    ], callback);
  }
}
