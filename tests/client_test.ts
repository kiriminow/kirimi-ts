import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KirimiClient, KirimiApiError, KirimiError } from '../src/mod.ts';

// ─── Mock factory ────────────────────────────────────────────────────────────

function mockFetch(
  status: number,
  body: unknown,
): typeof fetch {
  return async (_url: string | URL | Request, _init?: RequestInit) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// Capture last request for assertion
function capturingFetch(
  status: number,
  body: unknown,
): { fetch: typeof fetch; captured: { url: string; init: RequestInit | undefined }[] } {
  const captured: { url: string; init: RequestInit | undefined }[] = [];
  const fn: typeof fetch = async (url, init) => {
    captured.push({ url: url.toString(), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetch: fn, captured };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('KirimiClient constructor', () => {
  it('throws if userCode is empty', () => {
    assert.throws(
      () => new KirimiClient({ userCode: '', secret: 'x' }),
      KirimiError,
    );
  });

  it('throws if secret is empty', () => {
    assert.throws(
      () => new KirimiClient({ userCode: 'x', secret: '' }),
      KirimiError,
    );
  });
});

describe('sendMessage', () => {
  it('sends correct body with user_code, secret, device_id, phone, message', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
      message: 'ok',
    });

    const client = new KirimiClient({
      userCode: 'U123',
      secret: 'S456',
      fetch,
    });

    const resp = await client.sendMessage({
      deviceId: 'DEV1',
      phone: '628111222333',
      message: 'hello',
    });

    assert.equal(resp.success, true);
    assert.equal(captured.length, 1);

    const req = captured[0]!;
    assert.ok(req.url.endsWith('/v1/send-message'));

    const parsed = JSON.parse(req.init?.body as string);
    assert.equal(parsed.user_code, 'U123');
    assert.equal(parsed.secret, 'S456');
    assert.equal(parsed.device_id, 'DEV1');
    assert.equal(parsed.phone, '628111222333');
    assert.equal(parsed.message, 'hello');
    // mediaUrl not supplied → should not be in body
    assert.equal('media_url' in parsed, false);
  });

  it('includes media_url when provided', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendMessage({
      deviceId: 'd',
      phone: '628x',
      message: 'hi',
      mediaUrl: 'https://example.com/img.jpg',
    });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal(parsed.media_url, 'https://example.com/img.jpg');
  });
});

describe('generateOtp', () => {
  it('maps camelCase options to correct body fields', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.generateOtp({
      deviceId: 'D1',
      phone: '6281x',
      otpLength: 6,
      otpType: 'numeric',
      customOtpMessage: 'Your code is {otp}',
    });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal(parsed.otp_length, 6);
    assert.equal(parsed.otp_type, 'numeric');
    // API spec keeps this field camelCase
    assert.equal(parsed.customOtpMessage, 'Your code is {otp}');
    // snake_case variant should NOT be present
    assert.equal('custom_otp_message' in parsed, false);
  });

  it('omits optional fields when not provided', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.generateOtp({ deviceId: 'D1', phone: '6281x' });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal('otp_length' in parsed, false);
    assert.equal('otp_type' in parsed, false);
    assert.equal('customOtpMessage' in parsed, false);
  });
});

describe('broadcastMessage', () => {
  it('joins phones array with comma', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.broadcastMessage({
      deviceId: 'D1',
      phones: ['628111', '628222', '628333'],
      message: 'promo',
    });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal(parsed.phones, '628111,628222,628333');
  });

  it('accepts phones as string directly', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.broadcastMessage({
      deviceId: 'D1',
      phones: '628111,628222',
      message: 'promo',
    });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal(parsed.phones, '628111,628222');
  });
});

describe('error handling', () => {
  it('throws KirimiApiError on 401', async () => {
    const client = new KirimiClient({
      userCode: 'bad',
      secret: 'bad',
      fetch: mockFetch(401, {
        success: false,
        data: null,
        message: 'invalid credentials',
      }),
    });

    await assert.rejects(
      () => client.userInfo(),
      (err: unknown) => {
        assert.ok(err instanceof KirimiApiError);
        assert.equal(err.statusCode, 401);
        assert.ok(err.message.includes('invalid credentials'));
        return true;
      },
    );
  });

  it('throws KirimiApiError on 500 with fallback message', async () => {
    const client = new KirimiClient({
      userCode: 'u',
      secret: 's',
      fetch: mockFetch(500, {
        success: false,
        data: null,
        message: 'internal error',
      }),
    });

    await assert.rejects(
      () => client.listDevices(),
      (err: unknown) => {
        assert.ok(err instanceof KirimiApiError);
        assert.equal(err.statusCode, 500);
        return true;
      },
    );
  });

  it('throws KirimiApiError on 400', async () => {
    const client = new KirimiClient({
      userCode: 'u',
      secret: 's',
      fetch: mockFetch(400, {
        success: false,
        data: null,
        message: 'validation failed',
      }),
    });

    await assert.rejects(
      () =>
        client.sendMessage({ deviceId: '', phone: '', message: '' }),
      KirimiApiError,
    );
  });
});

describe('verifyOtpV2', () => {
  it('sends otp_code field in body', async () => {
    const { fetch, captured } = capturingFetch(200, {
      success: true,
      data: null,
    });

    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.verifyOtpV2({ phone: '628x', otpCode: '123456' });

    const parsed = JSON.parse(captured[0]!.init?.body as string);
    assert.equal(parsed.otp_code, '123456');
    assert.equal('otpCode' in parsed, false);
  });
});
