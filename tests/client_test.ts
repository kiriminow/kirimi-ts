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

/** Parse the JSON body of the most recent captured request. */
function lastBody(captured: { init: RequestInit | undefined }[]): Record<string, unknown> {
  return JSON.parse(captured[captured.length - 1]!.init?.body as string);
}

function makeClient() {
  return capturingFetch(200, { success: true, data: null, message: 'ok' });
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

  it('strips a trailing slash from baseUrl', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({
      userCode: 'u',
      secret: 's',
      baseUrl: 'https://api.kirimi.id/',
      fetch,
    });
    await client.userInfo();
    assert.equal(captured[0]!.url, 'https://api.kirimi.id/v1/user-info');
  });
});

describe('sendMessage', () => {
  it('sends receiver (not phone) with auth and device_id', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'U123', secret: 'S456', fetch });

    const resp = await client.sendMessage({
      deviceId: 'DEV1',
      receiver: '628111222333',
      message: 'hello',
    });

    assert.equal(resp.success, true);
    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/send-message'));
    assert.equal(parsed.user_code, 'U123');
    assert.equal(parsed.secret, 'S456');
    assert.equal(parsed.device_id, 'DEV1');
    assert.equal(parsed.receiver, '628111222333');
    assert.equal(parsed.message, 'hello');
    assert.equal('phone' in parsed, false);
    assert.equal('media_url' in parsed, false);
  });

  it('includes media_url and optional flags when provided', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendMessage({
      deviceId: 'd',
      receiver: '628x',
      message: 'hi',
      mediaUrl: 'https://example.com/img.jpg',
      fileName: 'img.jpg',
      enableTypingEffect: false,
      typingSpeedMs: 200,
      quotedMessageId: 'wamid.1',
    });

    const parsed = lastBody(captured);
    assert.equal(parsed.media_url, 'https://example.com/img.jpg');
    assert.equal(parsed.fileName, 'img.jpg');
    assert.equal(parsed.enableTypingEffect, false);
    assert.equal(parsed.typingSpeedMs, 200);
    assert.equal(parsed.quotedMessageId, 'wamid.1');
  });

  it('omits undefined optional fields entirely', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendMessage({ deviceId: 'd', receiver: '628x', message: 'hi' });

    const parsed = lastBody(captured);
    for (const key of ['media_url', 'fileName', 'enableTypingEffect', 'typingSpeedMs', 'quotedMessageId']) {
      assert.equal(key in parsed, false, `${key} should be omitted`);
    }
  });
});

describe('sendMessageFast', () => {
  it('sends receiver and omits typing-effect params', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendMessageFast({ deviceId: 'd', receiver: '628x', message: 'hi' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/send-message-fast'));
    assert.equal(parsed.receiver, '628x');
    assert.equal('enableTypingEffect' in parsed, false);
  });
});

describe('sendMessageFile', () => {
  it('builds multipart form with receiver, file and fileName', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendMessageFile({
      deviceId: 'd',
      receiver: '628x',
      file: new Uint8Array([1, 2, 3]),
      fileName: 'doc.pdf',
      message: 'caption',
      quotedMessageId: 'wamid.9',
    });

    const form = captured[0]!.init?.body as FormData;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('receiver'), '628x');
    assert.equal(form.get('device_id'), 'd');
    assert.equal(form.get('fileName'), 'doc.pdf');
    assert.equal(form.get('message'), 'caption');
    assert.equal(form.get('quotedMessageId'), 'wamid.9');
    assert.equal(form.get('phone'), null);
    assert.ok(form.get('file'));
  });
});

describe('broadcastMessage', () => {
  it('sends numbers as an array, never a joined string or phones', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.broadcastMessage({
      deviceId: 'D1',
      label: 'promo-juli',
      numbers: ['628111', '628222', '628333'],
      message: 'promo',
      delay: 30,
    });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/broadcast-message'));
    assert.ok(Array.isArray(parsed.numbers));
    assert.deepEqual(parsed.numbers, ['628111', '628222', '628333']);
    assert.equal(parsed.label, 'promo-juli');
    assert.equal('phones' in parsed, false);
  });

  it('maps delayMin/delayMax/startedAt to their snake_case fields', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.broadcastMessage({
      deviceId: 'D1',
      label: 'l',
      numbers: ['628111'],
      message: 'm',
      delayMin: 30,
      delayMax: 90,
      startedAt: '2026-03-01T10:00:00Z',
    });

    const parsed = lastBody(captured);
    assert.equal(parsed.delayMin, 30);
    assert.equal(parsed.delayMax, 90);
    assert.equal(parsed.started_at, '2026-03-01T10:00:00Z');
  });
});

describe('generateOtp', () => {
  it('maps camelCase options to snake_case body fields', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.generateOtp({
      deviceId: 'D1',
      phone: '6281x',
      otpLength: 6,
      otpType: 'numeric',
      customOtpText: 'KODE',
      customOtpMessage: 'Your code is {otp}',
    });

    const parsed = lastBody(captured);
    assert.equal(parsed.otp_length, 6);
    assert.equal(parsed.otp_type, 'numeric');
    assert.equal(parsed.customOtpText, 'KODE');
    assert.equal(parsed.customOtpMessage, 'Your code is {otp}');
    assert.equal('custom_otp_message' in parsed, false);
  });

  it('omits optional fields when not provided', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.generateOtp({ deviceId: 'D1', phone: '6281x' });

    const parsed = lastBody(captured);
    for (const key of ['otp_length', 'otp_type', 'customOtpText', 'customOtpMessage']) {
      assert.equal(key in parsed, false, `${key} should be omitted`);
    }
  });
});

describe('validateOtp', () => {
  it('sends otp for the V1 endpoint', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.validateOtp({ deviceId: 'd', phone: '628x', otp: '123456' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/validate-otp'));
    assert.equal(parsed.otp, '123456');
  });
});

describe('saveContact', () => {
  it('sends nama and nomor, never name/phone', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.saveContact({ nama: 'Budi', nomor: '628111', deviceId: 'd' });

    const parsed = lastBody(captured);
    assert.equal(parsed.nama, 'Budi');
    assert.equal(parsed.nomor, '628111');
    assert.equal(parsed.device_id, 'd');
    assert.equal('name' in parsed, false);
    assert.equal('phone' in parsed, false);
  });
});

describe('saveContactsBulk', () => {
  it('sends contacts array of {nama, nomor}', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.saveContactsBulk({
      contacts: [
        { nama: 'A', nomor: '628111' },
        { nama: 'B', nomor: '628222' },
      ],
    });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/save-contacts-bulk'));
    assert.deepEqual(parsed.contacts, [
      { nama: 'A', nomor: '628111' },
      { nama: 'B', nomor: '628222' },
    ]);
  });
});

describe('devices', () => {
  it('createDevice sends package_id and voucher_code', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.createDevice({ packageId: 3, voucherCode: 'PROMO10' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/create-device'));
    assert.equal(parsed.package_id, 3);
    assert.equal(parsed.voucher_code, 'PROMO10');
  });

  it('connectDevice sends device_id', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.connectDevice({ deviceId: 'D1' });

    assert.ok(captured[0]!.url.endsWith('/v1/connect-device'));
    assert.equal(lastBody(captured).device_id, 'D1');
  });

  it('renewDevice sends device_id and package_id', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.renewDevice({ deviceId: 'D1', packageId: 2 });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/renew-device'));
    assert.equal(parsed.device_id, 'D1');
    assert.equal(parsed.package_id, 2);
  });

  it('listDevices forwards page and limit', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.listDevices({ page: 2, limit: 25 });

    const parsed = lastBody(captured);
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 25);
  });
});

describe('WABA', () => {
  it('sendWabaMessage sends waba_id, to and template_name', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendWabaMessage({
      wabaId: 'WABA1',
      to: '628111',
      templateName: 'hello_world',
      variables: ['Budi'],
      header: { type: 'document', link: 'https://x/y.pdf', filename: 'y.pdf' },
    });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/waba/send-message'));
    assert.equal(parsed.waba_id, 'WABA1');
    assert.equal(parsed.to, '628111');
    assert.equal(parsed.template_name, 'hello_world');
    assert.deepEqual(parsed.variables, ['Budi']);
    assert.equal(parsed.header.type, 'document');
    assert.equal('device_id' in parsed, false);
  });

  it('wabaReply sends the message object', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.wabaReply({
      wabaId: 'WABA1',
      to: '628111',
      message: { type: 'text', text: 'halo' },
    });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/waba/messages/reply'));
    assert.deepEqual(parsed.message, { type: 'text', text: 'halo' });
  });

  it('wabaConversations defaults are left to the server and page/limit forwarded', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.wabaConversations({ page: 2, limit: 100 });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/waba/conversations'));
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 100);
  });

  it('wabaTemplatesSync sends waba_id', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.wabaTemplatesSync({ wabaId: 'WABA1' });

    assert.ok(captured[0]!.url.endsWith('/v1/waba/templates/sync'));
    assert.equal(lastBody(captured).waba_id, 'WABA1');
  });

  it('wabaSendOtp uses to and template_name', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.wabaSendOtp({ wabaId: 'W', to: '6281', templateName: 'otp_login' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/waba/send-otp'));
    assert.equal(parsed.waba_id, 'W');
    assert.equal(parsed.to, '6281');
    assert.equal(parsed.template_name, 'otp_login');
  });

  it('wabaVerifyOtp uses to and otp_code', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.wabaVerifyOtp({ wabaId: 'W', to: '6281', otpCode: '123456' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/waba/verify-otp'));
    assert.equal(parsed.otp_code, '123456');
    assert.equal('otpCode' in parsed, false);
  });
});

describe('sendOtpV2', () => {
  it('supports whatsapp method with app_name', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendOtpV2({ phone: '628x', method: 'whatsapp', appName: 'Toko' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v2/otp/send'));
    assert.equal(parsed.method, 'whatsapp');
    assert.equal(parsed.app_name, 'Toko');
    assert.equal('device_id' in parsed, false);
  });

  it('supports device method with custom_message', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendOtpV2({
      phone: '628x',
      method: 'device',
      deviceId: 'D1',
      customMessage: 'Kode {{otp}}',
    });

    const parsed = lastBody(captured);
    assert.equal(parsed.method, 'device');
    assert.equal(parsed.device_id, 'D1');
    assert.equal(parsed.custom_message, 'Kode {{otp}}');
  });

  it('supports waba_user method with waba_id and template_name', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.sendOtpV2({
      phone: '628x',
      method: 'waba_user',
      wabaId: 'W1',
      templateName: 'otp_auth',
    });

    const parsed = lastBody(captured);
    assert.equal(parsed.waba_id, 'W1');
    assert.equal(parsed.template_name, 'otp_auth');
  });
});

describe('verifyOtpV2', () => {
  it('sends otp_code field in body', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.verifyOtpV2({ phone: '628x', otpCode: '123456' });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v2/otp/verify'));
    assert.equal(parsed.otp_code, '123456');
    assert.equal('otpCode' in parsed, false);
  });
});

describe('otp reverse', () => {
  it('otpReverseCreate maps camelCase to snake_case', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.otpReverseCreate({
      phone: '628x',
      deviceId: 'D1',
      appName: 'Toko',
      callbackUrl: 'https://example.com/cb',
      customMessage: 'VERIFY {{token}} {{phone}}',
      successMessage: 'ok',
      failureMessage: 'fail',
    });

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v2/otp-reverse/create'));
    assert.equal(parsed.device_id, 'D1');
    assert.equal(parsed.app_name, 'Toko');
    assert.equal(parsed.callback_url, 'https://example.com/cb');
    assert.equal(parsed.custom_message, 'VERIFY {{token}} {{phone}}');
    assert.equal(parsed.success_message, 'ok');
    assert.equal(parsed.failure_message, 'fail');
  });

  it('otpReverseStatus sends token', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.otpReverseStatus({ token: '01HXYZ' });

    assert.ok(captured[0]!.url.endsWith('/v2/otp-reverse/status'));
    assert.equal(lastBody(captured).token, '01HXYZ');
  });
});

describe('deposits & packages', () => {
  it('createDeposit sends nominal', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.createDeposit({ nominal: 50000 });

    assert.ok(captured[0]!.url.endsWith('/v1/create-deposit'));
    assert.equal(lastBody(captured).nominal, 50000);
  });

  it('depositStatus and cancelDeposit send ref', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.depositStatus({ ref: 'REF1' });
    await client.cancelDeposit({ ref: 'REF2' });

    assert.ok(captured[0]!.url.endsWith('/v1/deposit-status'));
    assert.equal(JSON.parse(captured[0]!.init?.body as string).ref, 'REF1');
    assert.ok(captured[1]!.url.endsWith('/v1/cancel-deposit'));
    assert.equal(JSON.parse(captured[1]!.init?.body as string).ref, 'REF2');
  });

  it('listDeposits forwards filters', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.listDeposits({ status: 'paid', page: 2, limit: 5 });

    const parsed = lastBody(captured);
    assert.equal(parsed.status, 'paid');
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 5);
  });

  it('listPackages sends only auth', async () => {
    const { fetch, captured } = makeClient();
    const client = new KirimiClient({ userCode: 'u', secret: 's', fetch });
    await client.listPackages();

    const parsed = lastBody(captured);
    assert.ok(captured[0]!.url.endsWith('/v1/list-packages'));
    assert.deepEqual(Object.keys(parsed).sort(), ['secret', 'user_code']);
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
      () => client.sendMessage({ deviceId: '', receiver: '', message: '' }),
      KirimiApiError,
    );
  });

  it('exposes the response payload on the error', async () => {
    const client = new KirimiClient({
      userCode: 'u',
      secret: 's',
      fetch: mockFetch(402, {
        success: false,
        data: null,
        message: 'saldo tidak cukup',
      }),
    });

    await assert.rejects(
      () => client.sendOtpV2({ phone: '628x', method: 'whatsapp' }),
      (err: unknown) => {
        assert.ok(err instanceof KirimiApiError);
        assert.equal(err.statusCode, 402);
        assert.deepEqual(err.responseData, {
          success: false,
          data: null,
          message: 'saldo tidak cukup',
        });
        return true;
      },
    );
  });
});
