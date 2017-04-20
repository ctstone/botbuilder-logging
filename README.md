# Installation
```
npm install --save botbuilder-logging
```

## Peer dependencies
```
npm install --save documentdb azure-storage
```

And one or both of
```
npm install --save botbuilder
```

```
npm install --save botbuilder-calling
```

# Usage

## Configuration
```JavaScript
const SETTINGS = {
  blobs: {
    container: 'wavs'
  },
  documents: { // see winston-documentdb for more options
    databaseName: 'logs', 
    collectionName: 'bot1'
  },
  console: { }, // optional. See winston console transport options
}
```

## TypeScript
```TypeScript
import { BotLogger } from 'botbuilder-logging';
import { BlobService } from 'azure-storage';
import { DocumentClient } from 'documentdb';
import { UniversalBot } from 'botbuilder';
import { UniversalCallBot } from 'botbuilder-calling';

// your call bot
const callbot = new UniversalCallBot(/* params */);

// your chat bot
const chatbot = new UniversalBot(/* params */);

// storage resources
const blobs = new BlobService(/* params */);
const docs = new DocumentClient(/* params */);

// create logger
const logger = new BotLogger(blobs, docs, SETTINGS).on('error', console.error);

// use logger with callbot
callbot.use(logger.callingMiddleware);

// use logger with chatbot
chatbot.use(logger.chatMiddleware);
```

## JavaScript
```JavaScript
const bbl = require('botbuilder-logging');
const storage = require('azure-storage');
const ddb = require('documentdb');
const bb = require('botbuilder');
const bbc = require('botbuilder-calling');

// your call bot
const callbot = new bbc.UniversalCallBot(/* params */);

// your chat bot
const chatbot = new bb.UniversalBot(/* params */);

// storage resources
const blobs = new storage.BlobService(/* params */);
const docs = new ddb.DocumentClient(/* params */);

// create logger
const logger = new bbl.BotLogger(blobs, docs, SETTINGS).on('error', console.error);

// use logger with callbot
callbot.use(logger.callingMiddleware);

// use logger with chatbot
chatbot.use(logger.chatMiddleware);
```

## Error handling
Any errors encountered by the `DocumentClient` or `BlobService` are not returned through the bot middleware service. In order to capture these errors, listen to the logger's `error` event.
```JavaScript
botLogger.on('error', console.error);
```

# DocumentDB Partitioning
For large-scale DocumentDB collections (RU > 10K), the recommended partitionKey is `/meta/address/conversation/id`

# Log format
Logs are stored in DocumentDB as JSON documents.

Any available recordings on a `conversationResult` are stored under the configured blob container, with a SAS link stored on the DocumentDB document. Recordings are also stored on the document as a media attachment.

## Sample conversation event
```JavaScript
{
  "level": "info",
  "message": "conversation",
  "meta": {
    "agent": "botbuilder",
    "source": "skype",
    "sourceEvent": { /* snip */ },
    "type": "conversation",
    "callState": "incoming",
    "presentedModalityTypes": [ "audio" ],
    "address": { /* snip */ },
    "user": { /* snip */ }
  },
  "time": 1491954686989,
  "id": "7326bc5a-3f40-5879-5c1e-1953f192f028"
}
```

## Sample workflow event
```JavaScript
{
  "level": "info",
  "message": "workflow",
  "meta": {
    "type": "workflow",
    "agent": "botbuilder",
    "source": "skype",
    "address": { /* snip */},
    "actions": [
      {
        "action": "answer",
        "operationId": "a65f72cf-06b5-4085-9a6f-c553f3d16c5f"
      },
      {
        "maxDurationInSeconds": 10,
        "recordingFormat": "wav",
        "initialSilenceTimeoutInSeconds": 3,
        "maxSilenceTimeoutInSeconds": 1,
        "playBeep": false,
        "stopTones": [ "*" ],
        "action": "record",
        "operationId": "6b7cc981-3c17-4b0b-a78b-2545b51f4747",
        "playPrompt": {
          "action": "playPrompt",
          "operationId": "4bc66e9f-c36e-4f6f-9a83-1c6b439dea51",
          "prompts": [ { "value": "Some prompt" } ]
        }
      }
    ],
    "notificationSubscriptions": [ "callStateChange" ]
  },
  "time": 1491954687892,
  "id": "960df321-99ef-6cec-96c2-c7651853543f"
}
```

## Sample conversationResult event
```JavaScript
{
    "level": "info",
    "message": "conversationResult",
    "meta": {
      "agent": "botbuilder",
      "source": "skype",
      "sourceEvent": {/* snip */},
      "type": "conversationResult",
      "address": {/* snip */},
      "links": {/* snip */},
      "operationOutcome": {
        "type": "recordOutcome",
        "id": "6b7cc981-3c17-4b0b-a78b-2545b51f4747",
        "completionReason": "callTerminated",
        "lengthOfRecordingInSecs": 0.476,
        "format": "wav",
        "outcome": "success"
      },
      "recordedAudio": {
        "$media": "https://your-blob-account.blob.core.windows.net/wavs/audio-id.wav?with-sas-token"
      },
      "user": {/* snip */}
    },
    "time": 1491954693423,
    "id": "71f4fa9e-4c70-505a-1d26-66f02bff84eb"
  }
```

## Sample routing event
```JavaScript
{
    "level": "info",
    "message": "routing",
    "meta": {
      "domain": null,
      "options": {/* snip */},
      "msgSent": false,
      "lastSendTime": 1491954687819,
      "actions": [],
      "batchStarted": false,
      "sendingBatch": false,
      "library": {/* snip */},
      "promptDefaults": {/* snip */},
      "recognizeDefaults": {/* snip */},
      "recordDefaults": {/* snip */},
      "userData": {/* snip */},
      "conversationData": {/* snip */},
      "privateConversationData": {/* snip */}
    },
    "time": 1491954687821,
    "id": "26c70898-575e-6fca-11a0-74e32c98d12e"
  }
```