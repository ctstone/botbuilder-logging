import { BlobService } from 'azure-storage';
import { IEvent, UniversalBot } from 'botbuilder';
import { UniversalCallBot } from 'botbuilder-calling';
import { DocumentClient } from 'documentdb';
import { EventEmitter } from 'events';
import { Logger, LoggerInstance, transports } from 'winston';
import { DocumentDbConfig, DocumentDbLogger, DocumentDbOptions, Media, registerTransport } from 'winston-documentdb';

export interface BotBlobOptions {
  container: string;
}

export interface BotLoggerOptions {
  documents: DocumentDbConfig;
  blobs: BotBlobOptions;
}

export class BotLogger extends EventEmitter {
  private logger: LoggerInstance;
  private policy = {
    AccessPolicy: { Permissions: 'r', Expiry: '2099-12-31T23:59:59Z' },
  };
  private initialized: boolean;

  constructor(
    private blobService: BlobService,
    private documentClient: DocumentClient,
    private options: BotLoggerOptions) {
      super();
      const self = this;
      this.logger = new Logger()
        .add(DocumentDbLogger as any, Object.assign({client: documentClient}, options))
        .add(transports.Console, { level: 'error' });
      this.logger.transports.documentdb.on('media', (event: Media) => this.storeMedia(event));
    }

  register(bot: UniversalBot|UniversalCallBot): void {
    bot = bot as UniversalBot;
    bot.on('error', (err) => this.logger.error(err && err.message ? err.message : 'Error', err));
    bot.on('incoming', (event: IEvent) => this.logger.info(event.type, event));
    bot.on('outgoing', (event: IEvent) => this.logger.info(event.type, event));
    bot.on('routing', (session) => this.logger.info('routing', session));
    this.blobService.createContainerIfNotExists(this.options.blobs.container, (err) => {
      if (err) {
        this.emit('error', err);
      }
      this.initialized = true;
    });
  }

  private storeMedia(event: Media): void {
    if (!this.initialized) {
      setTimeout(() => this.storeMedia(event), 1000);
      return;
    }
    const name = event.id;
    const sas = this.blobService.generateSharedAccessSignature(this.options.blobs.container, name, this.policy);
    const url = this.blobService.getUrl(this.options.blobs.container, name, sas);
    event.id = url;
    this.blobService.createBlockBlobFromText(this.options.blobs.container, name, event.data, (err) => {
      if (err) {
        this.emit('error', err);
      }
    });
  }
}
