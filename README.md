# Installation
```
npm install --save botbuilder-logging
```

## Peer dependencies
```
npm install --save documentdb azure-storage botbuilder
```

# Usage

## TypeScript
```TypeScript
import { BotLogger } from 'botbuilder-logging';
import { BlobService } from 'azure-storage';
import { DocumentClient } from 'documentdb';
import { UniversalBot } from 'botbuilder';

// your chat bot
const chatbot = new UniversalBot(/* params */);

// create logger
const logger = new BotLogger(new DocumentClient(/* params */), {
  documents: {
    databaseName: 'logs1', 
    collectionName: 'bot1',
  },
  blobs: { // optional. use only if your bot processes binary content (images, speech)
    blobService: new BlobService(/* params */),
    options: { containerName: 'botmedia', }
  },
});

// logs are queued internally to prevent blocking the middleware pipeline
//   so logging errors are not visible to the bot
//   instead, catch logging IO errors in this event handler
logger.events.on('error', console.error);

// attach logger to the chatbot
chatbot.use(logger);
```

## Error handling
Any errors encountered by the `DocumentClient` or `BlobService` are not returned through the bot middleware service. In order to capture these errors, listen to the logger's `error` event.
```JavaScript
logger.events.on('error', console.error);
```

# Advanced
## DocumentDB Partitioning
For large-scale DocumentDB collections (RU > 10K), the recommended partitionKey is `/address/conversation/id`

## Log format
Logs are stored in DocumentDB as JSON documents. Any binary attachments (images, speech) are stored as attachments in DocumentDb, as well as on Azure Blob Storage, if it is configured.

## Extending the data store
To persist logs or blobs in arbitrary stores, implement your own `DocumentWriter` and `BlobWriter` classes. Then write your own bot middleware that calls `BotLogWriter.enqueue`. See class `BotLogger` for sample implementation.
