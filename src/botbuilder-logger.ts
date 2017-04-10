import { BlobService } from 'azure-storage';
import { IEvent, UniversalBot } from 'botbuilder';
import { UniversalCallBot } from 'botbuilder-calling';
import { DocumentClient } from 'documentdb';
import { LoggerInstance, loggers } from 'winston';
import { DocumentDbConfig, DocumentDbLogger, DocumentDbOptions, Media } from 'winston-documentdb';

export interface BotBlobOptions {
  container: string;
}

export interface BotLoggerOptions {
  documents: DocumentDbConfig;
  blobs: BotBlobOptions;
}

export class BotLogger {
  private logger: LoggerInstance;
  private policy = {
    AccessPolicy: { Permissions: 'r', Expiry: '2099-12-31T23:59:59Z' },
  };

  constructor(
    private blobService: BlobService,
    private documentClient: DocumentClient,
    private options: BotLoggerOptions) {
      const self = this;
      const ddbOptions = options.documents as DocumentDbOptions;
      ddbOptions.client = documentClient;
      this.logger = loggers.add('bot', { DocumentDb: ddbOptions }); // TODO add console logger with stripped-down data
      this.logger.transports.documentdb.on('media', function(event: Media) {
        self.storeMedia(this, event);
      });
    }

  register(bot: UniversalBot|UniversalCallBot): void {
    bot = bot as UniversalBot;
    bot.on('error', (err) => this.logger.error(err && err.message ? err.message : 'Error', err));
    bot.on('incoming', (event: IEvent) => this.logger.info(event.type, event));
    bot.on('outgoing', (event: IEvent) => this.logger.info(event.type, event));
    bot.on('routing', (session) => this.logger.info('routing', session));
  }

  private storeMedia(logger: DocumentDbLogger, event: Media): void {
    const sas = this.blobService.generateSharedAccessSignature(this.options.blobs.container, event.id, this.policy);
    event.id = this.blobService.getUrl(this.options.blobs.container, event.id, sas);
    this.blobService.createBlockBlobFromText(this.options.blobs.container, event.id, event.data, (err) => {
      if (err) {
        logger.emit('error', err);
      }
    });
  }
}
