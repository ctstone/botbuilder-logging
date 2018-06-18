# Bot Builder Logging

## Table of Contents

## Install

```
npm install botbuilder-logging@preview
```

## Peer dependencies
```
npm install documentdb azure-storage botbuilder@preview
```

> `azure-storage` is used to store binary data, which is typically only used in IVR bots. If you are not using an IVR bot, you can safely omit this peer dependency.

## Usage

### Attach the middleware

Attach a `BotLogger` middleware instance to your `BotFrameworkAdapter` to automatically persist all bot [Activity](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object) objects.

```JavaScript
const { BotFrameworkAdapter } = require('botbuilder');
const { BotLogger, writeLog } = require('botbuilder-logging');
const { DocumentClient } = require('documentdb');

// your documentdb instance
const documentdb = new DocumentClient(process.env.DDB_URI, {
  masterKey: process.env.DDB_KEY
});

// your bot adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// attach logging middleware
adapter.use(new BotLogger(documentdb, {
  documents: {
    databaseName: 'bot',
    collectionName: 'logs',
  },
}));
```

### Write custom logs

Use the `writeLog` function to persist arbitrary payloads from within your `processActivity` callback.

```JavaScript
const { BotLogger, writeLog } = require('botbuilder-logging');

adapter.processActivity(req, res, (context) => {
  writeLog(context, 'myLogType', {
    foo: 'hello world',
    bar: ['any', 'thing'],
  });
});
```

### Store WAV files for IVR bots

IVR bots can be configured to collect raw audio streams, which can be stored by this logger. To enable blob storage, pass an `azure-storage` instance in the BotLogger constructor:

```JavaScript
const { BlobService } = require('azure-storage');

const blobService = new BlobService(process.env.BLOB_ACCOUNT, process.env.BLOB_KEY);

// attach logging middleware with blob instance
adapter.use(new BotLogger(documentdb, {
  documents: {
    databaseName: 'bot',
    collectionName: 'logs',
  },
  blobs: {
    blobService,
    options: { container: 'botblobs' }
  }
}));


Any available audio data will automatically be stored in the configured blob container using a value of `{ $blob: 'URI' }` where URI points to your blob storage account and includes a Shared Access Signature (SAS).
```

### Options

The full definition of the `BotLogger` options is:

```TypeScript
interface BotLoggerOptions {

  /** Document Db options */
  documents: {

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
  };

  /** Azure Storage configuration */
  blobs: {

    /** Azure BlobService instance that will write media attachments */
    blobService: BlobService;

    /** Azure Storage options */
    options: {

      /** Blob container where media attachments will be stored */
      containerName: string;

      /** Use this shared access policy when linking log events to media blobs (default: read-only, expires in year 2099) */
      sasPolicy?: SharedAccessPolicy;
    },
  },

  /** Number of simultaneous writes before queueing (default: 1) */
  concurrency?: number;

  /** Set to true to persist state object to logs (default=true) */
  captureState?: boolean;

  /** Any properties that should NOT be visible in logs (e.g. "state.user.private.password"). For supported syntax, see `lodash.get` module. */
  maskedProperties?: string[];
}
```

## What is logged?

All of the available properties on each incoming and outcoming [Activity](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object) are automatically stored by the middleware.

The TypeScript interface for stored log entries is defined as
```TypeScript
interface LogEntry {
  date: Date;
  conversation: Partial<ConversationReference>;
  type: string;
  data: any;
}
```

- **date** is an [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) formatted string.
- **conversation** is the [ConversationAccount](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#conversationaccount-object) object associated with the log message. Use this object to correlate log messages for a given conversation or user.
- **type** may be one of the standard Bot Framework [activity types](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-activities?view=azure-bot-service-3.0), or it may be a user-defined string for custom log entries
- **data** may be either an [activity object](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object), or it may be any arbitrary object for custom log entries.

The serializer has special handling for certain JavaScript types found in the `data` property:
- A `function` is stored as `{ $function: null }`
- An `Error` object is stored as `{ $error: { name: err.name, message: err.message, stack: err.stack } }`
- A `Buffer` object is stored as `{ $blob: 'URI' }`, where URI is a string that points to a stored blob
- A `Date` object is stored as its `.toISOString()` value
- Any other object (besides a plain Object or Array) is stored as `{ $object: null }`

> Nested objects are stored recursively using `Object.keys`

## Extending the data store

To persist logs in other stores, extend the `BaseBotLogger` class, providing your own `DocumentWriter` and `BlobWriter` implementations.
