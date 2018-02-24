import { BlobService } from 'azure-storage';
import { Activity, Middleware, ResourceResponse } from 'botbuilder';
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

export class BotLogger implements Middleware {
  events = new EventEmitter();
  private writer: BotLogWriter;

  // TODO drop this after converting BotLogWriter to support Promises
  private enqueue = promisify((obj: any, callback: Callback<any>) => this.writer.enqueue(obj, callback));

  constructor(documentClient: DocumentClient, options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    this.writer = new BotLogWriter(documentWriter, blobWriter, options);
  }

  contextCreated(context: BotContext, next: () => Promise<void>): Promise<void> {
    return next().then(() => this.enqueue(context));
  }

  receiveActivity(context: BotContext, next: () => Promise<void>): Promise<void> {
    return next().then(() => this.enqueue(context));
  }

  postActivity(context: BotContext, activities: Array<Partial<Activity>>, next: () => Promise<ResourceResponse[]>): Promise<ResourceResponse[]> {
    console.log('are these equal?', context.responses === activities);
    return next().then(() => this.enqueue(context));
  }
}

export { AzureBlobWriter, AzureBlobWriterOptions, Callback, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
