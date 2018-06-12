import { BlobService } from 'azure-storage';
import { DocumentClient } from 'documentdb';

import { AzureBlobWriter, AzureBlobWriterOptions } from './azure-blob-writer';
import { BaseBotLogger, BotLogWriterOptions, getLogger, LOGGER_SERVICE_ID } from './base-bot-logger';
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

export class BotLogger extends BaseBotLogger {
  constructor(private documentClient: DocumentClient, private options: BotLoggerOptions) {
    super(
      new DocumentDbWriter(documentClient, options.documents),
      options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null,
      options);

    console.log(`[BotLogger] token=${this.getId()}`);
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

export { AzureBlobWriter, AzureBlobWriterOptions, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions, LOGGER_SERVICE_ID, getLogger };
