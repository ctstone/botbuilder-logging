import async = require('async');
import { Collection, DocumentClient, RequestCallback } from 'documentdb';
import { DocumentWriteCallback, DocumentWriter, WriteOperation } from './bot-logger-base';
import { Callback } from './callback';
import { Initializer } from './initializer';

const DEFAULT_THROUGHPUT = 10000;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

export interface DocumentDbWriterOptions {
  /** DocumentDb database name (created if it does not exist) */
  databaseName: string;

  /** DocumentDb collection name (created if it does not exist) */
  collectionName: string;

  /** Default configuration for created collections */
  defaults?: {

    /** Collection throughput for created collections */
    collectionThroughput?: number;

    /** Default time-to-live for created collections */
    ttl?: number;

    /** Partition key to use, if the collection is partitioned */
    partitionKey?: string;
  };
}

export class DocumentDbWriter implements DocumentWriter {
  private initializer = new Initializer((cb) => this.init(cb));
  private get db() { return `dbs/${this.options.databaseName}`; }
  private get coll() { return `${this.db}/colls/${this.options.collectionName}`; }

  constructor(private client: DocumentClient, private options: DocumentDbWriterOptions) {
    if (!options.defaults) {
      options.defaults = {};
    }
    if (!options.defaults.collectionThroughput) {
      options.defaults.collectionThroughput = DEFAULT_THROUGHPUT;
    }
  }

  write(operation: WriteOperation, callback: DocumentWriteCallback): void {
    async.series([
      (next: Callback<void>) => this.initializer.afterInit(next),
      (next: Callback<void>) => this.writeAfterInit(operation, next),
    ], callback);
  }

  private writeAfterInit(operation: WriteOperation, callback: Callback<void>): void {
    async.waterfall([
      (next: RequestCallback<any>) => this.client.createDocument(this.coll, operation.value, next),
      (doc: any, headers: any, next: Callback<any>) => {
        async.eachLimit(operation.blobs, 1, (blob, next: any) => {
          this.client.createAttachmentAndUploadMedia(doc._self, blob.data as any, next); // TODO media options like contentType
        }, next);
      },
    ], callback);
  }

  private init(callback: Callback<any>): void {
    async.series([
      (next: Callback<void>) => this.createDatabaseIfNotExists(next),
      (next: Callback<void>) => this.createCollectionIfNotExists(next),
    ], callback);
  }

  private createDatabaseIfNotExists(callback: Callback<void>) {
    async.waterfall([
      (next: Callback<boolean>) => this.databaseExists(next),
      (exists: boolean, next: Callback<any>) => {
        if (exists) { return next(null); }
        this.client.createDatabase({ id: this.options.databaseName }, (err) => {
          next(err && err.code !== HTTP_CONFLICT ? new Error(err.body) : null);
        });
      },
    ], callback);
  }

  private databaseExists(callback: Callback<boolean>) {
    this.client.readDatabase(this.db, (err, db) => {
      callback(err && err.code === HTTP_NOT_FOUND ? null : new Error(err.body), !!db);
    });
  }

  private createCollectionIfNotExists(callback: Callback<void>) {
    const collection: Collection = { id: this.options.collectionName };
    const options = { offerThroughput: this.options.defaults.collectionThroughput };

    if (this.options.defaults.ttl) {
      collection.defaultTtl = this.options.defaults.ttl;
    }

    if (this.options.defaults.partitionKey) {
      collection.partitionKey = { paths: [this.options.defaults.partitionKey], kind: 'Hash' };
    }

    async.waterfall([
      (next: Callback<boolean>) => this.collectionExists(next),
      (exists: boolean, next: Callback<any>) => {
        if (exists) { return next(null); }
        this.client.createCollection(this.db, collection, options, (err) => {
          next(err && err.code !== HTTP_CONFLICT ? new Error(err.body) : null);
        });
      },
    ], callback);
  }

  private collectionExists(callback: Callback<boolean>) {
    this.client.readCollection(this.coll, (err, coll) => {
      callback(err && err.code === HTTP_NOT_FOUND ? null : new Error(err.body), !!coll);
    });
  }
}
