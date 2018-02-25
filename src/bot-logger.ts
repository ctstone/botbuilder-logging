import { BlobService } from 'azure-storage';
import { Activity, ConversationReference, Intent, Middleware, ResourceResponse } from 'botbuilder';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';
import { promisify } from 'util';

import { AzureBlobWriter, AzureBlobWriterOptions } from './azure-blob-writer';
import { BotLogWriter, BotLogWriterOptions } from './bot-log-writer';
import { Callback } from './callback';
import { DocumentDbWriter, DocumentDbWriterOptions } from './documentdb-writer';

export interface BlobOptions {
  /** Options for Azure blob */
  options: AzureBlobWriterOptions;

  /** Azure BlobService instance that will write media attachments */
  blobService: BlobService;
}

export interface BotLoggerOptions extends BotLogWriterOptions {
  /** Options for DocumentDb */
  documents: DocumentDbWriterOptions;

  /** Optional configuration for handling binary content */
  blobs?: BlobOptions;
}

export interface LogEntry {
  type: string;
  date: Date;
  request: Partial<Activity>;
  responses: Array<Partial<Activity>>;
  responded: boolean;
  conversation: Partial<ConversationReference>;
  state: BotState;
  topIntent: Intent;
  error?: Error;
}

export class BotLogger implements Middleware {
  events = new EventEmitter();
  private writer: BotLogWriter;

  // TODO drop this after converting BotLogWriter to support Promises
  // private enqueue = promisify((obj: any, callback: Callback<any>) => this.writer.enqueue(obj, callback));

  constructor(documentClient: DocumentClient, options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    this.writer = new BotLogWriter(documentWriter, blobWriter, options);
  }

  postActivity(context: BotContext, activities: Array<Partial<Activity>>, next: () => Promise<ResourceResponse[]>): Promise<ResourceResponse[]> {
    const done = (err: Error) => this.onComplete(err);
    return next().then(() => {
      const entry = this.contextToLogEntry('postActivity', context);
      this.writer.enqueue(entry, done);
      return null;
    }, (err: Error) => {
      const entry = this.contextToLogEntry('error', context, err);
      this.writer.enqueue(entry, done);
    });
  }

  private onComplete(err: Error): void {
    if (err) {
      if (this.events.listenerCount('error') === 0) {
        console.error('Logging error', err);
      }
      this.events.emit('error', err);
    }
  }

  // TODO are there other objects that should be logged besides BotContext?
  private contextToLogEntry(type: string, context: BotContext, error?: Error): LogEntry {

    // map the relevant fields from context
    // TODO: are there more than these?
    return {
      type,
      date: new Date(),
      request: context.request,
      responses: context.responses,
      responded: context.responded,
      conversation: context.conversationReference,
      state: context.state,
      topIntent: context.topIntent,
      error,
    };
  }
}

export { AzureBlobWriter, AzureBlobWriterOptions, Callback, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
