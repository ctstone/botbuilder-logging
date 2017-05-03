import { BlobService } from 'azure-storage';
import { IEvent, IMiddlewareMap as IChatMiddlewareMap, UniversalBot } from 'botbuilder';
import { IMiddlewareMap as ICallingMiddlewareMap, UniversalCallBot } from 'botbuilder-calling';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';
import { ConsoleTransportOptions, Logger, LoggerInstance, transports } from 'winston';
import { DocumentDbTransport, DocumentDbTransportConfig, Media } from 'winston-documentdb';

export interface BotBlobOptions {
  container: string;
}

export interface BotLoggerOptions {
  documents: DocumentDbTransportConfig;
  console?: ConsoleTransportOptions;
  blobs: BotBlobOptions;
}

export class BotLogger extends EventEmitter {

  get callingMiddleware(): ICallingMiddlewareMap { return this.middleware; }
  get chatMiddleware(): IChatMiddlewareMap { return this.middleware; }

  private middleware = {
    botbuilder: (session: any, next: () => void) => this.onBotRouting(session, next),
    receive: (event: any, next: () => void) => this.onBotEvent(event, next),
    send: (event: any, next: () => void) => this.onBotEvent(event, next),
  };

  private initialized: boolean;
  private logger: LoggerInstance;
  private policy = {
    AccessPolicy: { Permissions: 'r', Expiry: '2099-12-31T23:59:59Z' }, // TODO add to options
  };

  constructor(
    private blobService: BlobService,
    private documentClient: DocumentClient,
    private options: BotLoggerOptions) {
      super();
      this.logger = new Logger()
        .add(DocumentDbTransport as any, Object.assign({client: documentClient}, options.documents))
        .add(transports.Console, Object.assign({ level: 'error' }, options.console)); // TODO add formatter here to handle metadata output
      this.logger.transports.documentdb.on('media', (event: Media) => this.storeMedia(event));
  }

  private formatConsoleLog(options: any): string {
    return '';
  }

  private onBlobContainerCreated(err: Error): void {
    this.onCallback(err);
    if (!err) {
      this.initialized = true;
    }
  }

  private onBotError(err: Error): void {
    const message = err && err.message ? err.message : 'Error';
    this.logger.error(message, err, (err) => this.onCallback);
  }

  private onBotEvent(event: IEvent, callback: () => void): void {
    this.logger.info(event.type, event, (err) => this.onCallback);
    callback();
  }

  private onBotRouting(session: any, callback: () => void): void {
    this.logger.info('routing', session, (err) => this.onCallback);
    callback();
  }

  private onCallback(err: Error) {
    if (err) {
      this.emit('error', err);
    }
  }

  private storeMedia(event: Media): void {
    if (!this.initialized) {
      this.blobService.createContainerIfNotExists(this.options.blobs.container, (err) => this.onBlobContainerCreated(err));
      setTimeout(() => this.storeMedia(event), 1000);
      return;
    }
    const name = `${event.id}.wav`;
    const sas = this.blobService.generateSharedAccessSignature(this.options.blobs.container, name, this.policy);
    const url = this.blobService.getUrl(this.options.blobs.container, name, sas);
    event.id = url;
    this.blobService.createBlockBlobFromText(this.options.blobs.container, name, event.data, (err) => this.onCallback(err));
  }
}
