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

export interface BotContextWithLogger extends BotContext {
  logger: BotLogger;
}

export class BotLogger implements Middleware {
  events: EventEmitter;
  private writer: BotLogWriter;

  constructor(private documentClient: DocumentClient, private options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    this.writer = new BotLogWriter(documentWriter, blobWriter, options);
    this.events = this.writer.events;

    console.log(`[BotLogger] token=${this.getId()}`);
  }

  contextCreated?(context: BotContextWithLogger, next: () => Promise<void>): Promise<void> {
    context.logger = this;
    return next();
  }

  postActivity(context: BotContext, activities: Array<Partial<Activity>>, next: () => Promise<ResourceResponse[]>): Promise<ResourceResponse[]> {
    return next()
      .then((responses) => {
        [context.request].concat(context.responses)
          .forEach((activity) => this.write(context, activity.type, activity));
        return responses;
      })
      .catch((err) => {
        this.write(context, 'error', err);
        throw err;
      });
  }

  /**
   * Write arbitrary log event for the current conversation (the conversationReference and date are automatically logged)
   * @param context The current context object
   * @param type The type of log event. Use this value to filter similar events when querying the logs
   * @param data Some arbitrary data to write
   */
  write(context: BotContext, type: string, data: any): void {
    this.writer.write(context, type, data);
  }

  private getId(): string {
    return Buffer.from(JSON.stringify({
      type: 'cosmosdb',
      // tslint:disable-next-line:no-string-literal
      account: this.documentClient['sessionContainer'].getHostName(),
      database: this.options.documents.databaseName,
      collection: this.options.documents.collectionName,
    })).toString('base64');
  }
}

export { AzureBlobWriter, AzureBlobWriterOptions, Callback, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
