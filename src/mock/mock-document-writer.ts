import { DocumentWriteCallback, DocumentWriter, WriteOperation } from "../base-bot-logger";

export class MockDocumentWriter implements DocumentWriter {
  operations: WriteOperation[] = [];
  write(op: WriteOperation, callback: DocumentWriteCallback): void {
    this.operations.push(op);
    callback(null);
  }
}
