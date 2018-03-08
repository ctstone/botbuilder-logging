import * as async from 'async';
import { ConversationReference } from 'botbuilder';
import { EventEmitter } from 'events';
import _get = require('lodash.get');
import _set = require('lodash.set');

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

  /** Set to true to persist state object to logs (default=true) */
  captureState?: boolean;

  /** When capturing state, add properties that should NOT be stored in logs here (e.g. "user.private.password"). For supported syntax, see `lodash.get` module. */
  privateStateProperties?: string[];

  /** When masking private state variables, mask them with this string (default= character-for-character '*'s) */
  maskPrivateStateWith?: string;
}

export interface WriteOperation {
  value: any;
  blobs: Blob[];
}

export interface LogEntry {
  date: Date;
  conversation: Partial<ConversationReference>;
  type: string;
  data: any;
  state: BotState;
}

export class BotLogWriter {
  events = new EventEmitter();
  private documentQueue: async.AsyncQueue<WriteOperation>;
  private blobQueue: async.AsyncQueue<Blob>;

  constructor(private documentWriter: DocumentWriter, private blobWriter: BlobWriter, private options: BotLogWriterOptions) {
    if (!options.concurrency) {
      options.concurrency = 1;
    }
    if (this.options.captureState !== false) {
      this.options.captureState = true;
    }
    this.documentQueue = async.queue((op, next) => this.documentWriter.write(op, next), options.concurrency);
    this.blobQueue = async.queue((blob, next) => this.blobWriter ? this.blobWriter.write(blob, next) : next(null), options.concurrency);
  }

  write(context: BotContext, type: string, data: any): void {
    const entry: LogEntry = {
      date: new Date(),
      type,
      conversation: context.conversationReference,
      data,
      state: this.cleanState(context.state),
    };
    this.enqueue(entry, (err: Error) => this.onWrite(err));
  }

  private enqueue(entry: any, callback: Callback<any>): void {
    const blobs: Blob[] = [];
    const value = serialize(entry, (blob) => this.blobWriter.locate(blob), blobs);

    async.parallel([
      (next: Callback<void>) => this.documentQueue.push({ value, blobs }, callback),
      (next: Callback<void>) => async.each(blobs, (blob, next) => this.blobQueue.push(blob, next), next),
    ], callback);
  }

  private onWrite(err: Error): void {
    if (err) {
      if (this.events.listenerCount('error') === 0) {
        console.error('Logging error', err);
      }
      this.events.emit('error', err);
    }
  }

  private cleanState(state: any): any {
    if (this.options.captureState) {
      if (Array.isArray(this.options.privateStateProperties)) {
        state = JSON.parse(JSON.stringify(state)); // clone
        this.options.privateStateProperties.forEach((x) => {
          const redacted = _get(state, x).replace(/./g, '*');
          _set(state, x, redacted);
        });
      }
      return state;
    } else {
      return {};
    }
  }
}
