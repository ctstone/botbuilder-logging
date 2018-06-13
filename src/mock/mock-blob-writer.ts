import { BlobWriteCallback, BlobWriter } from "../base-bot-logger";
import { Blob, serialize } from '../serialization';

export class MockBlobWriter implements BlobWriter {
  blobs: Blob[] = [];
  write(blob: Blob, callback: BlobWriteCallback): void {
    this.blobs.push(blob);
    callback(null);
  }

  locate(blob: Blob): string {
    return blob.hash;
  }
}
