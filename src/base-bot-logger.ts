import * as async from 'async';
import { IAddress, IEvent, IMiddlewareMap, Session } from "botbuilder";
import { EventEmitter } from "events";
import _get = require('lodash.get');
import _set = require('lodash.set');

import { Callback } from './callback';
import { Blob, serialize } from './serialization';

export const LOGGER_SERVICE_ID = Symbol('bot-logger');

export interface LogEntry {
  date: Date;
  conversation: Partial<IAddress>;
  type: string;
  data: any;
}

export interface BotLogWriterOptions {
  /** Number of simultaneous writes before queueing (default: 1) */
  concurrency?: number;

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

export function getLogger(session: Session) {
  return session[LOGGER_SERVICE_ID] as LogWriter;
}

function setLogger(session: Session, logger: BaseBotLogger) {
  const logWriter: LogWriter = (type: string, data: any) => logger.write(session, type, data);
  session[LOGGER_SERVICE_ID] = logWriter;
}

function hasLogger(session: Session) {
  return !!getLogger(session);
}

export function writeLog(session: Session, type: string, data: any) {
  getLogger(session)(type, data);
}

export class BaseBotLogger implements IMiddlewareMap {

  events = new EventEmitter();
  private documentQueue: async.AsyncQueue<WriteOperation>;
  private blobQueue: async.AsyncQueue<Blob>;

  constructor(protected documentWriter: DocumentWriter, protected blobWriter: BlobWriter, protected loggerOptions: BotLogWriterOptions) {
    if (!loggerOptions.concurrency) {
      loggerOptions.concurrency = 1;
    }
    this.documentQueue = async.queue((op, next) => this.documentWriter.write(op, next), loggerOptions.concurrency);
    this.blobQueue = async.queue((blob, next) => this.blobWriter ? this.blobWriter.write(blob, next) : next(null), loggerOptions.concurrency);
  }

  receive(event: IEvent, next: () => void) {
    this.write(null, event.type, event);
    next();
  }

  send(event: IEvent, next: () => void) {
    this.write(null, event.type, event);
    next();
  }

  botbuilder(session: Session, next: () => void) {
    if (!hasLogger(session)) {
      setLogger(session, this);
    }
    next();
  }

  write(session: Session, type: string, data: any): void {
    const entry: LogEntry = {
      date: new Date(),
      type,
      conversation: session.message.address,
      data,
    };
    this.enqueue(this.applyMask(entry), (err: Error) => this.onWrite(err));
  }

  private enqueue(entry: any, callback: Callback<any>): void {
    const blobs: Blob[] = [];
    const value = serialize(entry, (blob) => this.blobWriter.locate(blob), blobs);

    async.parallel([
      (next: Callback<void>) => this.documentQueue.push({ value, blobs }, next),
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
