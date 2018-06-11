# Bot Builder Logging

## Table of Contents

## Install

```
npm install --save botbuilder-logging
```

## Peer dependencies
```
npm install --save documentdb azure-storage botbuilder
```

## Usage (TypeScript)

```TypeScript
import { BlobService } from 'azure-storage';
import { BotFrameworkAdapter } from 'botbuilder';
import { BotLogger } from 'botbuilder-logging';
import { DocumentClient } from 'documentdb';

// your bot adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// your documentdb instance
const documentdb = new DocumentClient('uri', {masterKey: 'masterKey'});

// create logger
const logger = new BotLogger(documentdb, {
  documents: {
    databaseName: 'bot', // created if it does not exist
    collectionName: 'logs', // created if it does not exist
  },

  defaults: { // all optional
    collectionThroughput: 500, // set throughput if collection has to be created
    ttl: 86400, // set time-to-live if collection has to be created
    partitionKey: 'path/to/key', // set partitionKey if collection has to be created
  }
});

// any logging errors are emitted as events
logger.events.on('error', console.error);

// attach logger to your to your bot adapter
adapter.use(logger);
```

## Extending the data store

To persist logs in other stores, implement `BaseBotLogger` and `DocumentWriter`
