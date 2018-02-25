import { BlobService } from 'azure-storage';
import { Activity, ConversationReference, Middleware, ResourceResponse } from 'botbuilder';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';

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
  date: Date;
  entry: Partial<Activity | ConversationReference>;
  state: BotState;
  error?: Error;
}

export class BotLogger implements Middleware {
  events = new EventEmitter();
  private writer: BotLogWriter;

  constructor(documentClient: DocumentClient, options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    this.writer = new BotLogWriter(documentWriter, blobWriter, options);
  }

  postActivity(context: BotContext, activities: Array<Partial<Activity>>, next: () => Promise<ResourceResponse[]>): Promise<ResourceResponse[]> {
    const done = (err: Error) => this.onComplete(err);
    return next().then(() => {
      [context.request].concat(context.responses)
        .map((activity) => this.toLogEntry(activity, context.state))
        .forEach((activity) => this.writer.enqueue(activity, done));
      return null;
    }, (err: Error) => {
      this.writer.enqueue(this.toLogEntry(context.conversationReference, context.state, err), done);
      return err;
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

  private toLogEntry(entry: Partial<Activity | ConversationReference>, state: any, error?: Error): LogEntry {
    return { date: new Date(), entry, state, error };
  }
}

export { AzureBlobWriter, AzureBlobWriterOptions, Callback, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
