import { BlobService } from 'azure-storage';
import { IEvent, IMiddlewareMap, Session } from 'botbuilder';
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

export class BotLogger implements IMiddlewareMap {
  events = new EventEmitter();
  private writer: BotLogWriter;

  constructor(documentClient: DocumentClient, options: BotLoggerOptions) {
    const documentWriter = new DocumentDbWriter(documentClient, options.documents);
    const blobWriter = options.blobs ? new AzureBlobWriter(options.blobs.blobService, options.blobs.options) : null;
    this.writer = new BotLogWriter(documentWriter, blobWriter, options);
  }

  botbuilder(session: Session, next: Callback<void>): void {
    this.writer.enqueue(session, (err) => this.done(err));
    next();
  }

  receive(event: IEvent, next: Callback<void>): void {
    this.writer.enqueue(event, (err) => this.done(err));
    next();
  }

  send(event: IEvent, next: Callback<void>): void {
    this.writer.enqueue(event, (err) => this.done(err));
    next();
  }

  private done(err: Error): void {
    if (err) { this.events.emit('error', err); }
  }
}

export { AzureBlobWriter, AzureBlobWriterOptions, Callback, BotLogWriter, BotLogWriterOptions, DocumentDbWriter, DocumentDbWriterOptions };
