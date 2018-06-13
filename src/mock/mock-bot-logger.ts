import { BaseBotLogger } from "../base-bot-logger";
import { MockBlobWriter } from "./mock-blob-writer";
import { MockDocumentWriter } from "./mock-document-writer";

export class MockBotLogger extends BaseBotLogger {
  mockDocumentWriter = this.documentWriter;
  mockBlobWriter = this.blobWriter;
  constructor() {
   super(new MockDocumentWriter(), new MockBlobWriter(), {});
  }
}
