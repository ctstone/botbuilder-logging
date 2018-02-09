import { BlobService, common } from 'azure-storage';
import { IMiddlewareMap } from 'botbuilder';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';
import { Logger, LoggerInstance, transports } from 'winston';
import { DocumentDbTransport, DocumentDbTransportConfig, Media } from 'winston-documentdb';

const defaultSasPolicy: common.SharedAccessPolicy = {
  AccessPolicy: { Permissions: 'r', Expiry: '2099-12-31T23:59:59Z' },
};

export interface BlobOptions {
  /** Blob container where media attachments will be stored */
  container: string;

  /** Use this shared access policy when linking log events to media blobs (default: read-only, expires in year 2099) */
  sasPolicy?: common.SharedAccessPolicy;
}

export interface MediaOptions {
  /** Options for media logging */
  options: BlobOptions;

  /** Blob Service that will write media attachments */
  blobs: BlobService;
}

export interface BotLoggerOptions {
  /** DocumentDb options */
  documents: DocumentDbTransportConfig;

  /** (optional) Media attachment options */
  media?: MediaOptions;
}

/** Bot middleware to support logging of bot events and media objects (blobs) to durable storage */
export class BotLogger extends EventEmitter implements IMiddlewareMap {
  logger: LoggerInstance;

  constructor(
    private documentClient: DocumentClient,
    private options: BotLoggerOptions) {
      super();
      this.logger = new Logger()
        .add(DocumentDbTransport as any, Object.assign({client: documentClient}, options.documents));

      if (options.media) {
        this.logger.transports.documentdb.on('media', (event: Media) => this.storeMedia(event));
      }
  }

  botbuilder(session: any, next: any): void {
    this.logger.info('routing', session, (err) => this.emitIfError(err));
    next();
  }
  receive(event: any, next: any): void {
    this.logger.info(event.type, event, (err) => this.emitIfError(err));
    next();
  }
  send(event: any, next: any): void {
    this.logger.info(event.type, event, (err) => this.emitIfError(err));
    next();
  }

  private emitIfError(err: Error): void {
    if (err) { this.emit('error', err); }
  }

  private storeMedia(event: Media): void {
    const blobs = this.options.media.blobs;
    const container = this.options.media.options.container;
    const policy = this.options.media.options.sasPolicy || defaultSasPolicy;
    const blobName = event.id; // TODO extension?

    const sas = blobs.generateSharedAccessSignature(container, blobName, policy);
    const url = blobs.getUrl(container, blobName, sas);
    event.id = url;

    blobs.createContainerIfNotExists(container, (err) => {
      this.emitIfError(err);

      if (!err) {
        blobs.createBlockBlobFromText(container, blobName, event.data, (err) => this.emitIfError(err));
      }
    });
  }
}
