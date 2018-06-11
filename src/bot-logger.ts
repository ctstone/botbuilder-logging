import { BlobService } from 'azure-storage';
import { Middleware, TurnContext } from 'botbuilder';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';

import { AzureBlobWriter, AzureBlobWriterOptions } from './azure-blob-writer';
import { BotLogWriter, BotLogWriterOptions } from './bot-log-writer';
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

export interface LoggerTurnContext {
  logger: BotLogger;
  log: (type: string, data: any) => void;
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

  async onTurn(context: LoggerTurnContext & TurnContext, next: () => Promise<void>): Promise<void> {
    context.logger = this;
    context.log = (type: string, data: any) => this.write(context, type, data);

    await context.onSendActivities(async (handlerContext, activities, handlerNext) => {
      [].concat(handlerContext.activity, activities)
        .forEach((activity) => this.write(handlerContext, activity.type, activity));
      return await handlerNext();
    });

    await next();
  }

  /**
   * Write arbitrary log event for the current conversation (the conversationReference and date are automatically logged)
   * @param context The current context object
   * @param type The type of log event. Use this value to filter similar events when querying the logs
   * @param data Some arbitrary data to write
   */
  write(context: TurnContext, type: string, data: any): void {
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

export { AzureBlobWriter, AzureBlobWriterOptions, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
