# RingCentral Call JS SDK

[![Coverage Status](https://coveralls.io/repos/github/ringcentral/ringcentral-call-js/badge.svg?branch=master)](https://coveralls.io/github/ringcentral/ringcentral-call-js?branch=master)
[![NPM Version](https://img.shields.io/npm/v/ringcentral-call.svg?style=flat-square)](https://www.npmjs.com/package/ringcentral-call)
[![Build Status](https://travis-ci.org/ringcentral/ringcentral-call-js.svg?branch=master)](https://travis-ci.org/ringcentral/ringcentral-call-js)

RingCentral Call aims to help developers to make and control call easily with RingCentral Web Phone and Call Control APIs. In this SDK, we use Web Phone for voice transmission, use Call Control API for call control.

## Prerequisites

* You will need an active RingCentral account to create RingCentral app. Don't have an account? [Get your Free RingCentral Developer Account Now!](https://developers.ringcentral.com/)
* A RingCentral app
    * App type: Browser-Based or Server/Web
    * Permissions: 'Call Control', 'Read Accounts', 'Read Presence', 'Webhook Subscriptions', 'VoIP Calling'

## Install

Use npm or yarn

```bash
$ yarn add @ringcentral/sdk @ringcentral/subscriptions ringcentral-call-control ringcentral-web-phone ringcentral-call
```

Use CDN scripts

```html
<script type="text/javascript" src="https://unpkg.com/es6-promise@latest/dist/es6-promise.auto.js"></script>
<script type="text/javascript" src="https://unpkg.com/pubnub@latest/dist/web/pubnub.js"></script>
<script type="text/javascript" src="https://unpkg.com/whatwg-fetch@latest/dist/fetch.umd.js"></script>
<script type="text/javascript" src="https://unpkg.com/@ringcentral/sdk@latest/dist/ringcentral.js"></script>
<script type="text/javascript" src="https://unpkg.com/@ringcentral/subscriptions@latest/dist/ringcentral-subscriptions.js"></script>
<script type="text/javascript" src="https://unpkg.com/sip.js@0.13.5/dist/sip.js"></script>
<script type="text/javascript" src="https://unpkg.com/ringcentral-web-phone@0.7.7/dist/ringcentral-web-phone.js"></script>
<script type="text/javascript" src="https://unpkg.com/ringcentral-call@0.2.0/build/index.js"></script>
```

## Demo

Online: [Demo](https://ringcentral.github.io/ringcentral-call-js/)

Run in local:

```
$ git clone https://github.com/ringcentral/ringcentral-call-js.git
$ cd ringcentral-call-js
$ yarn
$ yarn build
$ yarn start
```

Open `http://localhost:8080/demo/`, and login with RingCentral account to test.

## Usage

For this example you will also need to have [RingCentral JS SDK](https://github.com/ringcentral/ringcentral-js/tree/master/sdk#installation), [RingCentral JS Subscriptions SDK](https://github.com/ringcentral/ringcentral-js/tree/master/subscriptions#installation), [RingCentral Web Phone](https://github.com/ringcentral/ringcentral-web-phone) and [RingCentral Call Control](https://github.com/ringcentral/ringcentral-call-control) installed.

Create RingCentral Call instances:

```js
var appClientId = '...'; 
var appClientSecret = '...';
var appName = '...';
var appVersion = '...';
var rcCall;

var sdk = new RingCentral.SDK({
  clientId: appClientId,
  clientSecret: appClientSecret,
  appName: appName,
  appVersion: appVersion,
  server: RingCentral.SDK.server.production // or .sandbox
});
var subscriptions = new RingCentral.Subscriptions({ sdk });

var platform = sdk.platform();

platform
  .login({
    username: '...',
    password: '...'
  })
  .then(function() {
    return platform
            .post('/restapi/v1.0/client-info/sip-provision', {
              sipInfo: [{transport: 'WSS'}]
            })
  })
  .then(function(res) {
    return res.json();
  })
  .then(function(sipProvision) {
    // create RingCentral web phone instance
    var rcWebPhone = new RingCentral.WebPhone(sipProvision, {
      appKey: appClientId,
      appName: 'RingCentral Call Demo',
      appVersion: '0.0.1'
    });

    // create RingCentral call instance
    rcCall = new RingCentralCall({ webphone: rcWebPhone, sdk: sdk, subscriptions: subscriptions });
    return rcCall;
  })
```

## API

### Initialize

Firstly, we need to create [RingCentral JS SDK](https://github.com/ringcentral/ringcentral-js#installation) instance and [RingCentral Web Phone](https://github.com/ringcentral/ringcentral-web-phone#application) instance. Then pass them when initialize RingCentral Call instance:

```js
var rcCall = new RingCentralCall({ webphone: rcWebPhone, sdk: sdk });
```

### Events

### New call session event

```js
var session = null;

rcCall.on('new', (newSession) => {
  session = newSession;
});
```

### Webphone registered event

```js
rcCall.on('webphone-registered', function () {
  //  web phone feature is ready
});
```

### Call control ready event

```js
rcCall.on('call-control-ready', function () {
  //  call control feature is ready
});
```

### Sessions List

```js
var sessions = rcCall.sessions;
```

### Session API

#### Start a call

```js
rcCall.makeCall({
  type: 'webphone',
  toNumber: 'phone number',
  fromNumber: 'from number',
}).then((session) => {
  // ...
})
```

#### Hangup a call

```js
session.hangup().then(...)
```

#### Hold a call

```js
session.hold().then(...)
```

#### Unhold a call

```js
session.unhold().then(...)
```

#### To voicemail

```js
session.toVoicemail().then(...)
```

#### Reject a call

```js
session.reject().then(...)
```

#### Answer a call

```js
session.answer().then(...)
```

#### Forward a call

```js
session.forward('forward number').then(...)
```

#### Transfer a call

```js
session.forward('transfer number').then(...)
```

#### Mute a call

```js
session.mute().then(...)
```

#### Unmute a call

```js
session.unmute().then(...)
```

### Session Event

Status changed event

```js
session.on('status', ({ party }) => {
  // console.log(part)
});
```

## TODO

- [ ] Call Switch
- [ ] Conference Call Support
