import * as async from 'async';
import { BlobService, common } from 'azure-storage';
import { Blob } from './blob';
import { BlobWriteCallback, BlobWriter } from './bot-logger-base';
import { Callback } from './callback';
import { Initializer } from './initializer';

const DEFAULT_SAS_POLICY: common.SharedAccessPolicy = {
  AccessPolicy: { Permissions: 'r', Expiry: '2099-12-31T23:59:59Z' },
};

export interface AzureBlobWriterOptions {
  /** Blob container where media attachments will be stored */
  containerName: string;

  /** Use this shared access policy when linking log events to media blobs (default: read-only, expires in year 2099) */
  sasPolicy?: common.SharedAccessPolicy;
}

export class AzureBlobWriter implements BlobWriter {
  private initializer = new Initializer((cb) => this.init(cb));

  constructor(private blobs: BlobService, private options: AzureBlobWriterOptions) {
    if (!this.options.sasPolicy) {
      this.options.sasPolicy = DEFAULT_SAS_POLICY;
    }
  }

  write(blob: Blob, callback: BlobWriteCallback): void {
    async.series([
      (next: Callback<void>) => this.initializer.afterInit(next),
      (next: Callback<any>) => this.blobs.createBlockBlobFromText(this.options.containerName, blob.hash, blob.data, next),
    ], callback);
  }

  locate(blob: Blob): string {
    const sas = this.blobs.generateSharedAccessSignature(this.options.containerName, blob.hash, this.options.sasPolicy);
    return this.blobs.getUrl(this.options.containerName, blob.hash, sas);
  }

  private init(callback: Callback<any>): void {
    this.blobs.createContainerIfNotExists(this.options.containerName, callback);
  }
}
