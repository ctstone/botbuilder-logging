# Bot Builder Logging

## Table of Contents

-   [Install](#install)
-   [Peer dependencies](#peer-dependencies)
-   [Usage](#usage)
    -   [Attach the middleware](#attach-the-middleware)
    -   [Error handling](#error-handling)
    -   [Write custom logs](#write-custom-logs)
    -   [Store WAV files for IVR bots](#store-wav-files-for-ivr-bots)
    -   [Options](#options)
-   [What is logged?](#what-is-logged)
-   [Extending the data store](#extending-the-data-store)

## Install

> This package is compatible with Bot Framework SDK version `3.x`. If you are using Bot Framework `4.x` please switch to [botbuilder-logging@preview](https://www.npmjs.com/package/botbuilder-logging/v/preview).

    npm install botbuilder-logging

## Peer dependencies

    npm install documentdb azure-storage botbuilder

> `azure-storage` is used to store binary data, which is typically only used in IVR bots. If you are not using an IVR bot, you can safely omit this peer dependency.

## Usage

### Attach the middleware

Attach a `BotLogger` middleware instance to your `UniversalBot` to automatically persist all bot [Activity](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object) objects.

```JavaScript
const { ChatConnector, UniversalBot  } = require('botbuilder');
const { BotLogger, writeLog } = require('botbuilder-logging');
const { DocumentClient } = require('documentdb');

// your documentdb instance
const documentdb = new DocumentClient(process.env.DDB_URI, {
  masterKey: process.env.DDB_KEY
});

// your chat connector
const connector = new ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// your bot
const bot = new UniversalBot(connector, (session) => {
    session.send(`You said: ${session.message.text}`);
});

// attach logging middleware
bot.use(new BotLogger(documentdb, {
  documents: {
    databaseName: 'bot',
    collectionName: 'logs',
  },
}));
```

### Error handling

Log messages are pushed into a queue to avoid blocking the request, so errors are not available from the calling code.

Instead, attach an error event handler at the time the `BotLogger` is created

```JavaScript
botLogger.events.on('error', (err) => console.error(err));
```

### Write custom logs

Use the `writeLog` function to persist arbitrary payloads from within your bot logic.

```JavaScript
const { BotLogger, writeLog } = require('botbuilder-logging');

bot.dialog('greetings', [
  (session) => {
    builder.Prompts.text(session, 'Hi! What is your name?');
  },
  (session, results) => {
    writeLog(session, 'info', results); // log the response
    session.endDialog(`Hello ${results.response}!`);
  },
]);
```

### Store WAV files for IVR bots

IVR bots can be configured to collect raw audio streams, which can be stored by this logger. To enable blob storage, pass an `azure-storage` instance in the BotLogger constructor:

```JavaScript
const { BlobService } = require('azure-storage');

const blobService = new BlobService(process.env.BLOB_ACCOUNT, process.env.BLOB_KEY);

// attach logging middleware with blob instance
bot.use(new BotLogger(documentdb, {
  documents: {
    databaseName: 'bot',
    collectionName: 'logs',
  },
  blobs: {
    blobService,
    options: { container: 'botblobs' }
  }
}));
```

Any available audio data will automatically be stored in the configured blob container using a value of `{ $blob: 'URI' }` where URI points to your blob storage account and includes a Shared Access Signature (SAS).

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

  /** Any properties that should NOT be visible in logs (e.g. "state.user.private.password"). For supported syntax, see `lodash.get` module. */
  maskedProperties?: string[];
}
```

## What is logged?

All of the available properties on each incoming and outbound [Activity](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object) are automatically stored by the middleware.

The TypeScript interface for stored log entries is defined as

```TypeScript
interface LogEntry {
  date: Date;
  conversation: Partial<ConversationReference>;
  type: string;
  data: any;
}
```

-   **date** is an [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) formatted string.
-   **conversation** is the [ConversationAccount](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#conversationaccount-object) object associated with the log message. Use this object to correlate log messages for a given conversation or user.
-   **type** may be one of the standard Bot Framework [activity types](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-activities?view=azure-bot-service-3.0), or it may be a user-defined string for custom log entries
-   **data** may be either an [activity object](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference?view=azure-bot-service-3.0#activity-object), or it may be any arbitrary object for custom log entries.

The serializer has special handling for certain JavaScript types found in the `data` property:

-   A `function` is stored as `{ $function: null }`
-   An `Error` object is stored as `{ $error: { name: err.name, message: err.message, stack: err.stack } }`
-   A `Buffer` object is stored as `{ $blob: 'URI' }`, where URI is a string that points to a stored blob
-   A `Date` object is stored as its `.toISOString()` value
-   Any other object (besides a plain Object or Array) is stored as `{ $object: null }`

> Nested objects are stored recursively using `Object.keys`

## Extending the data store

To persist logs in other stores, extend the `BaseBotLogger` class, providing your own `DocumentWriter` and `BlobWriter` implementations.
