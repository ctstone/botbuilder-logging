import * as async from 'async';
import { ConversationReference, Middleware, TurnContext } from "botbuilder";
import { EventEmitter } from "events";
import _get = require('lodash.get');
import _set = require('lodash.set');

import { Callback } from './callback';
import { Blob, serialize } from './serialization';

export const LOGGER_SERVICE_ID = Symbol('bot-logger');

export interface LogEntry {
  date: Date;
  conversation: Partial<ConversationReference>;
  type: string;
  data: any;

  // disabled: cannot access state without the original BotState middleware instance
  // state: BotState;
}

export interface BotLogWriterOptions {
  /** Number of simultaneous writes before queueing (default: 1) */
  concurrency?: number;

  /** Set to true to persist state object to logs (default=true) */
  captureState?: boolean;

  /** Any properties that should NOT be visible in logs (e.g. "state.user.private.password"). For supported syntax, see `lodash.get` module. */
  maskedProperties?: string[];
}

export interface WriteOperation {
  value: any;
  blobs: Blob[];
}

export interface DocumentWriter {
  write: (op: WriteOperation, callback: DocumentWriteCallback) => void;
}

export interface BlobWriter {
  write: (blob: Blob, callback: BlobWriteCallback) => void;
  locate: (blob: Blob) => string;
}

export type LogWriter = (type: string, data: any) => void;
export type DocumentWriteCallback = (err?: Error) => void;
export type BlobWriteCallback = (err?: Error) => void;

export function getLogger(context: TurnContext) {
  return context.services.get(LOGGER_SERVICE_ID) as LogWriter;
}

export function writeLog(context: TurnContext, type: string, data: any) {
  getLogger(context)(type, data);
}

export class BaseBotLogger implements Middleware {

  events = new EventEmitter();
  private documentQueue: async.AsyncQueue<WriteOperation>;
  private blobQueue: async.AsyncQueue<Blob>;

  constructor(protected documentWriter: DocumentWriter, protected blobWriter: BlobWriter, protected loggerOptions: BotLogWriterOptions) {
    if (!loggerOptions.concurrency) {
      loggerOptions.concurrency = 1;
    }
    if (this.loggerOptions.captureState !== false) {
      this.loggerOptions.captureState = true;
    }
    this.documentQueue = async.queue((op, next) => this.documentWriter.write(op, next), loggerOptions.concurrency);
    this.blobQueue = async.queue((blob, next) => this.blobWriter ? this.blobWriter.write(blob, next) : next(null), loggerOptions.concurrency);
  }

  async onTurn(context: TurnContext, next: () => Promise<void>): Promise<void> {
    if (!context.services.has(LOGGER_SERVICE_ID)) {
      const logWriter: LogWriter = (type: string, data: any) => this.write(context, type, data);
      context.services.set(LOGGER_SERVICE_ID, logWriter);
    }

    await context.onSendActivities(async (handlerContext, activities, handlerNext) => {
      [].concat(handlerContext.activity, activities)
        .forEach((activity) => this.write(handlerContext, activity.type, activity));
      return await handlerNext();
    });

    await next();
  }

  write(context: TurnContext, type: string, data: any): void {
    const entry: LogEntry = {
      date: new Date(),
      type,
      conversation: TurnContext.getConversationReference(context.activity),
      data,

      // state: this.options.captureState ? context.state : {},
    };
    this.enqueue(this.applyMask(entry), (err: Error) => this.onWrite(err));
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

  private applyMask(entry: LogEntry): LogEntry {
    if (Array.isArray(this.loggerOptions.maskedProperties)) {
      entry = JSON.parse(JSON.stringify(entry)); // clone
      this.loggerOptions.maskedProperties.forEach((x) => {
        const val = _get(entry, x);
        if (typeof val === 'string') {
          _set(entry, x, val.replace(/./g, '*'));
        } else if (val !== undefined) {
          _set(entry, x, { $redacted: true });
        }
      });
    }
    return entry;
  }
}
