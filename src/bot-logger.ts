import { BlobService } from 'azure-storage';
import { DocumentClient } from 'documentdb';
import { AzureBlobWriter, AzureBlobWriterOptions } from './azure-blob-writer';
import { BotLoggerBase, BotLoggerOptionsBase } from './bot-logger-base';
import { DocumentDbWriter, DocumentDbWriterOptions } from './documentdb-writer';

export interface MediaOptions {
  /** Options for Azure blob */
  options: AzureBlobWriterOptions;

  /** Azure BlobService instance that will write media attachments */
  blobService: BlobService;
}

export interface BotLoggerOptions extends BotLoggerOptionsBase {
  /** Options for DocumentDb */
  documents: DocumentDbWriterOptions;

  /** Optional configuration for handling binary content */
  blobs?: MediaOptions;
}

export class BotLogger extends BotLoggerBase {
  constructor(documentClient: DocumentClient, options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    super(documentWriter, blobWriter, options);
  }
}
