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
  phone: '628111222333',
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

## Methods

All methods return `Promise<KirimiResponse<T>>`:
```typescript
interface KirimiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message?: string;
}
```

### WhatsApp Unofficial

#### `sendMessage`
```typescript
await client.sendMessage({ deviceId, phone, message, mediaUrl? });
```

#### `sendMessageFast`
Kirim tanpa efek mengetik:
```typescript
await client.sendMessageFast({ deviceId, phone, message, mediaUrl? });
```

#### `sendMessageFile`
Upload file langsung (max 50 MB). Terima `Blob`, `File`, atau `Uint8Array`:
```typescript
const file = await Deno.readFile('./doc.pdf'); // Uint8Array
await client.sendMessageFile({ deviceId, phone, file, fileName: 'doc.pdf', message? });

// atau dengan File/Blob
const blob = new Blob(['hello'], { type: 'text/plain' });
await client.sendMessageFile({ deviceId, phone, file: blob, fileName: 'hello.txt' });
```

### WABA

#### `sendWabaMessage`
```typescript
await client.sendWabaMessage({ deviceId, phone, message });
```

### Devices

```typescript
await client.listDevices();
await client.deviceStatus({ deviceId });
await client.deviceStatusEnhanced({ deviceId });
```

### User

```typescript
await client.userInfo();
```

### Contacts

```typescript
await client.saveContact({ phone, name?, email? });
```

### OTP

#### Generate & validate (V1)
```typescript
await client.generateOtp({
  deviceId, phone,
  otpLength?: 6,
  otpType?: 'numeric' | 'alphabetic' | 'alphanumeric',
  customOtpMessage?: 'Kode OTP kamu: {otp}',
});

await client.validateOtp({ deviceId, phone, otp: '123456' });
```

#### Send & verify (V2)
```typescript
await client.sendOtpV2({
  phone, deviceId,
  method?: 'device' | 'waba',
  appName?, templateCode?, customMessage?,
});

await client.verifyOtpV2({ phone, otpCode: '123456' });
```

### Broadcast

`phones` bisa string atau array — array di-join dengan `,`:
```typescript
await client.broadcastMessage({
  deviceId,
  phones: ['628111', '628222'],
  message: 'Promo!',
  delay?: 3, // detik antar pesan
});
```

### Deposits

```typescript
await client.listDeposits({ status?: 'paid' | 'unpaid' | 'expired' | '' });
await client.listPackages();
```

## Error Handling

```typescript
import { KirimiClient, KirimiApiError, KirimiTimeoutError, KirimiError } from '@kirimi/sdk';

try {
  const resp = await client.sendMessage({ deviceId, phone, message });
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

## Usage in Cloudflare Workers / Edge Runtimes

SDK menggunakan native `fetch` — langsung kompatibel tanpa konfigurasi tambahan:

```typescript
// worker.ts
import { KirimiClient } from '@kirimi/sdk';

export default {
  async fetch(request: Request): Promise<Response> {
    const client = new KirimiClient({
      userCode: env.KIRIMI_USER_CODE,
      secret: env.KIRIMI_SECRET,
    });

    const resp = await client.sendMessage({
      deviceId: env.KIRIMI_DEVICE_ID,
      phone: '628111222333',
      message: 'Hello from the edge!',
    });

    return Response.json(resp);
  },
};
```

## Testing / Mocking

Inject `fetch` di constructor untuk mocking:

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
