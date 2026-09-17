# @kirimi/sdk

[![JSR](https://jsr.io/badges/@kirimi/sdk)](https://jsr.io/@kirimi/sdk)
[![npm](https://img.shields.io/npm/v/@kirimi/sdk)](https://www.npmjs.com/package/@kirimi/sdk)

TypeScript SDK for the [Kirimi](https://kirimi.id) WhatsApp API.

- TypeScript-first, fully typed
- ESM only — no CommonJS
- Zero external dependencies
- Native `fetch` — works in Node 18+, Deno, Bun, browser, Cloudflare Workers, and any edge runtime
- Native `FormData` for file uploads

## Installation

**Deno (JSR)**
```sh
deno add jsr:@kirimi/sdk
```

**Node.js (JSR)**
```sh
npx jsr add @kirimi/sdk
```

**Bun (JSR)**
```sh
bunx jsr add @kirimi/sdk
```

**npm**
```sh
npm install @kirimi/sdk
```

## Quick Start

```typescript
import { KirimiClient } from '@kirimi/sdk';

const client = new KirimiClient({
  userCode: 'YOUR_USER_CODE',
  secret: 'YOUR_SECRET',
});

const resp = await client.sendMessage({
  deviceId: 'YOUR_DEVICE_ID',
  receiver: '628111222333',
  message: 'Halo dari Kirimi SDK!',
});

console.log(resp.success); // true
```

## Constructor Options

```typescript
const client = new KirimiClient({
  userCode: 'USER',        // required
  secret: 'SECRET',        // required
  baseUrl: 'https://api.kirimi.id', // optional, default shown
  timeout: 30000,          // optional, ms, default 30s
  fetch: customFetch,      // optional, inject custom fetch
});
```

Auth travels in the request body (`user_code` + `secret`), never in a header. Every method
returns `Promise<KirimiResponse<T>>`:

```typescript
interface KirimiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message?: string;
}
```

## Two send paths, don't mix them

- **QR Scan device** — unofficial, free-form text any time, supports groups. Can drop.
- **WABA (Meta Cloud API)** — official, stable. Business-initiated messages must use an
  approved template. Free-form replies only inside the 24h customer service window
  (`wabaReply`). No group support. Uses `wabaId`, never `deviceId`.

> For WABA, a success response means Meta **accepted** the message (`delivery_status:
> "accepted"`), not that it was delivered. The final state arrives via webhook as
> `message.sent`, `message.ack`, `message.failed`.

## Methods

### WhatsApp (QR device)

```typescript
await client.sendMessage({ deviceId, receiver, message, mediaUrl?, fileName?,
  enableTypingEffect?, typingSpeedMs?, quotedMessageId? });

await client.sendMessageFast({ deviceId, receiver, message, mediaUrl?, fileName?, quotedMessageId? });

await client.sendMessageFile({ deviceId, receiver, file, fileName?, message?, caption?, quotedMessageId? });

await client.broadcastMessage({ deviceId, label, numbers: [...], message,
  delay?, delayMin?, delayMax?, mediaUrl?, fileName?, startedAt? });
```

`sendMessageFile` accepts `Blob`, `File`, or `Uint8Array` (max 50 MB).
`broadcastMessage` takes `numbers` as an **array** (max 1000) and requires `label`.
The server clamps `delay` to 30–3600 seconds.

### WABA (Cloud API)

```typescript
await client.sendWabaMessage({ wabaId, to, templateName, variables?, header?, buttons? });

await client.wabaReply({ wabaId, to, message });        // free text within 24h window
await client.wabaConversations({ limit?, page? });      // numbers still in the window
await client.wabaTemplatesSync({ wabaId });             // refresh template status from Meta
await client.wabaSendOtp({ wabaId, to, templateName });
await client.wabaVerifyOtp({ wabaId, to, otpCode });
```

Reply `message` shapes:

```typescript
{ type: 'text', text: 'Halo' }
{ type: 'image', media_url: 'https://…', caption: 'Brosur' }   // also audio/video
{ type: 'document', media_url: 'https://…', filename: 'a.pdf' }
{ type: 'interactive', interactive: { /* Meta interactive object */ } }
```

Template `header` (required for media or dynamic text headers):

```typescript
await client.sendWabaMessage({
  wabaId: '1000000000',
  to: '628111222333',
  templateName: 'order_update',
  variables: ['Budi', 'INV-001'],
  header: { type: 'document', link: 'https://cdn.example.com/invoice.pdf', filename: 'invoice.pdf' },
});
```

### Devices

```typescript
await client.createDevice({ packageId, voucherCode? });
await client.connectDevice({ deviceId });
await client.renewDevice({ deviceId, packageId, voucherCode? });
await client.listDevices({ page?, limit? });
await client.deviceStatus({ deviceId });
await client.deviceStatusEnhanced({ deviceId });
```

### User

```typescript
await client.userInfo();
```

### Contacts

```typescript
await client.saveContact({ nama, nomor, deviceId? });
await client.saveContactsBulk({ contacts: [{ nama, nomor }], deviceId? }); // max 1000
```

Existing numbers are skipped, not overwritten.

### OTP v2 (recommended)

`method` is one of `whatsapp` (alias `waba`), `device`, or `waba_user`.

```typescript
// Via the official Kirimi provider — Rp 595 per delivered OTP, no own number needed
await client.sendOtpV2({ phone, method: 'whatsapp', appName: 'MyApp' });

// Via your own connected device — free
await client.sendOtpV2({ phone, method: 'device', deviceId,
  customMessage: 'Kode OTP kamu: {{otp}}' });

// Via your own WABA + AUTHENTICATION template — free, Meta bills your WABA
await client.sendOtpV2({ phone, method: 'waba_user', wabaId, templateName: 'otp_login' });

await client.verifyOtpV2({ phone, otpCode: '123456' });
```

`customMessage` must contain `{{otp}}` and be 10–500 characters.

### OTP v1 (legacy)

```typescript
await client.generateOtp({ deviceId, phone, otpLength?, otpType?, customOtpText?,
  customOtpMessage?, enableTypingEffect?, typingSpeedMs? });
await client.validateOtp({ deviceId, phone, otp });
```

`otpType` is `'numeric' | 'alphabetic' | 'alphanumeric'`. `customOtpMessage` must contain
the `{otp}` placeholder (single braces).

### OTP Reverse (customer-initiated)

```typescript
const { data } = await client.otpReverseCreate({
  phone, deviceId, appName?, callbackUrl?,
  customMessage: 'VERIFY {{token}} {{phone}}',
});
// Send data.message_text to the customer; they reply with it to your device.

await client.otpReverseStatus({ token });
```

Status is `pending` | `verified` | `phone_mismatch` | `expired`. The token is valid
10 minutes and single use. When verification completes, Kirimi POSTs to `callbackUrl`
with the header `x-kirimi-event: otp-reverse.verified`.

### Packages & Deposits

```typescript
await client.listPackages();
await client.createDeposit({ nominal });        // min 100 IDR
await client.depositStatus({ ref });
await client.cancelDeposit({ ref });            // must still be unpaid
await client.listDeposits({ page?, limit?, status? });
```

Payment links are valid 24 hours; a maximum of 2 unpaid deposits may exist at once.

## Error Handling

```typescript
import { KirimiClient, KirimiApiError, KirimiTimeoutError, KirimiError } from '@kirimi/sdk';

try {
  await client.sendMessage({ deviceId, receiver, message });
} catch (err) {
  if (err instanceof KirimiApiError) {
    console.error(`API error ${err.statusCode}:`, err.message);
    console.error('Response:', err.responseData);
  } else if (err instanceof KirimiTimeoutError) {
    console.error('Request timed out');
  } else if (err instanceof KirimiError) {
    console.error('SDK error:', err.message);
  }
}
```

| Status | Meaning |
|---|---|
| 400 | invalid or missing params |
| 401 | wrong `user_code` / `secret` |
| 402 | insufficient balance (`sendOtpV2` whatsapp) |
| 403 | feature not in package / subscription inactive |
| 404 | not found |
| 429 | rate limited |
| 500 | server error |
| 502 | number undeliverable |
| 503 | provider outage |

## Usage in Cloudflare Workers / Edge Runtimes

```typescript
import { KirimiClient } from '@kirimi/sdk';

export default {
  async fetch(request: Request): Promise<Response> {
    const client = new KirimiClient({
      userCode: env.KIRIMI_USER_CODE,
      secret: env.KIRIMI_SECRET,
    });

    const resp = await client.sendMessage({
      deviceId: env.KIRIMI_DEVICE_ID,
      receiver: '628111222333',
      message: 'Hello from the edge!',
    });

    return Response.json(resp);
  },
};
```

## Testing / Mocking

Inject `fetch` in the constructor to mock:

```typescript
const client = new KirimiClient({
  userCode: 'test',
  secret: 'test',
  fetch: async (url, init) => {
    return new Response(JSON.stringify({ success: true, data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
```

## License

MIT — see [LICENSE](./LICENSE).
