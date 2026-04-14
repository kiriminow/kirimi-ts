import { KirimiApiError, KirimiError, KirimiTimeoutError } from './errors.ts';
import type {
  BroadcastMessageOptions,
  DeviceStatusOptions,
  GenerateOtpOptions,
  KirimiClientOptions,
  KirimiResponse,
  ListDepositsOptions,
  SaveContactOptions,
  SendMessageFileOptions,
  SendMessageFastOptions,
  SendMessageOptions,
  SendOtpV2Options,
  SendWabaMessageOptions,
  ValidateOtpOptions,
  VerifyOtpV2Options,
} from './types.ts';

const DEFAULT_BASE_URL = 'https://api.kirimi.id';
const DEFAULT_TIMEOUT = 30_000;

/**
 * Client for the Kirimi API.
 *
 * @example
 * ```ts
 * import { KirimiClient } from '@kirimi/sdk';
 *
 * const client = new KirimiClient({ userCode: 'USER', secret: 'SECRET' });
 * const resp = await client.sendMessage({ deviceId: 'DEV', phone: '628xxx', message: 'halo' });
 * ```
 */
export class KirimiClient {
  private readonly userCode: string;
  private readonly secret: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly _fetch: typeof fetch;

  constructor(options: KirimiClientOptions) {
    if (!options.userCode) throw new KirimiError('userCode is required');
    if (!options.secret) throw new KirimiError('secret is required');

    this.userCode = options.userCode;
    this.secret = options.secret;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  /** Build the auth payload shared by all endpoints */
  private auth(): { user_code: string; secret: string } {
    return { user_code: this.userCode, secret: this.secret };
  }

  /** Execute a JSON POST request */
  private async post<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<KirimiResponse<T>> {
    return this._request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Execute a multipart/form-data POST request */
  private async postForm<T>(
    path: string,
    form: FormData,
  ): Promise<KirimiResponse<T>> {
    // Do NOT set Content-Type manually — fetch sets it with the boundary
    return this._request<T>(path, { method: 'POST', body: form });
  }

  private async _request<T>(
    path: string,
    init: RequestInit,
  ): Promise<KirimiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeout,
    );

    let response: Response;
    try {
      response = await this._fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new KirimiTimeoutError(this.timeout);
      }
      throw new KirimiError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    let data: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { success: false, data: null, message: text };
    }

    if (!response.ok) {
      const msg =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as Record<string, unknown>)['message'] === 'string'
          ? (data as Record<string, unknown>)['message'] as string
          : `HTTP ${response.status}`;
      throw new KirimiApiError(response.status, msg, data);
    }

    return data as KirimiResponse<T>;
  }

  // ─── WhatsApp Unofficial ────────────────────────────────────────────────

  /**
   * Send a text/media message to a single recipient.
   * @see https://api.kirimi.id/v1/send-message
   */
  sendMessage<T = unknown>(
    opts: SendMessageOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/send-message', {
      ...this.auth(),
      device_id: opts.deviceId,
      phone: opts.phone,
      message: opts.message,
      ...(opts.mediaUrl !== undefined && { media_url: opts.mediaUrl }),
    });
  }

  /**
   * Send a message with an attached file via multipart/form-data (max 50 MB).
   * Accepts `Blob`, `File`, or raw `Uint8Array` as the file input.
   * @see https://api.kirimi.id/v1/send-message-file
   */
  sendMessageFile<T = unknown>(
    opts: SendMessageFileOptions,
  ): Promise<KirimiResponse<T>> {
    const form = new FormData();
    form.append('user_code', this.userCode);
    form.append('secret', this.secret);
    form.append('device_id', opts.deviceId);
    form.append('phone', opts.phone);

    // Copy to a plain ArrayBuffer to satisfy strict Blob constructor types
    const blob =
      opts.file instanceof Uint8Array
        ? (() => {
            const ab = new ArrayBuffer(opts.file.byteLength);
            new Uint8Array(ab).set(opts.file as Uint8Array<ArrayBuffer>);
            return new Blob([ab], { type: 'application/octet-stream' });
          })()
        : opts.file;

    form.append('file', blob, opts.fileName ?? 'file');
    if (opts.message !== undefined) form.append('message', opts.message);

    return this.postForm<T>('/v1/send-message-file', form);
  }

  /**
   * Send a message without the typing indicator effect.
   * @see https://api.kirimi.id/v1/send-message-fast
   */
  sendMessageFast<T = unknown>(
    opts: SendMessageFastOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/send-message-fast', {
      ...this.auth(),
      device_id: opts.deviceId,
      phone: opts.phone,
      message: opts.message,
      ...(opts.mediaUrl !== undefined && { media_url: opts.mediaUrl }),
    });
  }

  // ─── WABA ───────────────────────────────────────────────────────────────

  /**
   * Send a message via WhatsApp Business API (Meta Cloud API).
   * @see https://api.kirimi.id/v1/waba/send-message
   */
  sendWabaMessage<T = unknown>(
    opts: SendWabaMessageOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/send-message', {
      ...this.auth(),
      device_id: opts.deviceId,
      phone: opts.phone,
      message: opts.message,
    });
  }

  // ─── Devices ────────────────────────────────────────────────────────────

  /**
   * List all devices associated with the account.
   * @see https://api.kirimi.id/v1/list-devices
   */
  listDevices<T = unknown>(): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-devices', this.auth());
  }

  /**
   * Check the connection status of a device.
   * @see https://api.kirimi.id/v1/device-status
   */
  deviceStatus<T = unknown>(
    opts: DeviceStatusOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/device-status', {
      ...this.auth(),
      device_id: opts.deviceId,
    });
  }

  /**
   * Get detailed status information for a device.
   * @see https://api.kirimi.id/v1/device-status-enhanced
   */
  deviceStatusEnhanced<T = unknown>(
    opts: DeviceStatusOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/device-status-enhanced', {
      ...this.auth(),
      device_id: opts.deviceId,
    });
  }

  // ─── User ───────────────────────────────────────────────────────────────

  /**
   * Retrieve information about the authenticated account.
   * @see https://api.kirimi.id/v1/user-info
   */
  userInfo<T = unknown>(): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/user-info', this.auth());
  }

  // ─── Contacts ───────────────────────────────────────────────────────────

  /**
   * Save a contact to the account.
   * @see https://api.kirimi.id/v1/save-contact
   */
  saveContact<T = unknown>(
    opts: SaveContactOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/save-contact', {
      ...this.auth(),
      phone: opts.phone,
      ...(opts.name !== undefined && { name: opts.name }),
      ...(opts.email !== undefined && { email: opts.email }),
    });
  }

  // ─── OTP ────────────────────────────────────────────────────────────────

  /**
   * Generate and send an OTP via a WhatsApp device.
   * @see https://api.kirimi.id/v1/generate-otp
   */
  generateOtp<T = unknown>(
    opts: GenerateOtpOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/generate-otp', {
      ...this.auth(),
      device_id: opts.deviceId,
      phone: opts.phone,
      ...(opts.otpLength !== undefined && { otp_length: opts.otpLength }),
      ...(opts.otpType !== undefined && { otp_type: opts.otpType }),
      // API uses camelCase for this field per spec
      ...(opts.customOtpMessage !== undefined && {
        customOtpMessage: opts.customOtpMessage,
      }),
    });
  }

  /**
   * Validate an OTP code that was previously sent.
   * @see https://api.kirimi.id/v1/validate-otp
   */
  validateOtp<T = unknown>(
    opts: ValidateOtpOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/validate-otp', {
      ...this.auth(),
      device_id: opts.deviceId,
      phone: opts.phone,
      otp: opts.otp,
    });
  }

  /**
   * Send an OTP via WABA template or device (V2 API).
   * @see https://api.kirimi.id/v2/otp/send
   */
  sendOtpV2<T = unknown>(opts: SendOtpV2Options): Promise<KirimiResponse<T>> {
    return this.post<T>('/v2/otp/send', {
      ...this.auth(),
      phone: opts.phone,
      device_id: opts.deviceId,
      ...(opts.method !== undefined && { method: opts.method }),
      ...(opts.appName !== undefined && { app_name: opts.appName }),
      ...(opts.templateCode !== undefined && {
        template_code: opts.templateCode,
      }),
      ...(opts.customMessage !== undefined && {
        custom_message: opts.customMessage,
      }),
    });
  }

  /**
   * Verify an OTP code (V2 API).
   * @see https://api.kirimi.id/v2/otp/verify
   */
  verifyOtpV2<T = unknown>(
    opts: VerifyOtpV2Options,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v2/otp/verify', {
      ...this.auth(),
      phone: opts.phone,
      otp_code: opts.otpCode,
    });
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────

  /**
   * Broadcast a message to multiple recipients.
   * `phones` accepts a string or string array; arrays are joined with ','.
   * @see https://api.kirimi.id/v1/broadcast-message
   */
  broadcastMessage<T = unknown>(
    opts: BroadcastMessageOptions,
  ): Promise<KirimiResponse<T>> {
    const phones = Array.isArray(opts.phones)
      ? opts.phones.join(',')
      : opts.phones;
    return this.post<T>('/v1/broadcast-message', {
      ...this.auth(),
      device_id: opts.deviceId,
      phones,
      message: opts.message,
      ...(opts.delay !== undefined && { delay: opts.delay }),
    });
  }

  // ─── Deposits ───────────────────────────────────────────────────────────

  /**
   * List deposits for the account.
   * @see https://api.kirimi.id/v1/list-deposits
   */
  listDeposits<T = unknown>(
    opts?: ListDepositsOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-deposits', {
      ...this.auth(),
      ...(opts?.status !== undefined && { status: opts.status }),
    });
  }

  /**
   * List available packages.
   * @see https://api.kirimi.id/v1/list-packages
   */
  listPackages<T = unknown>(): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-packages', this.auth());
  }
}
