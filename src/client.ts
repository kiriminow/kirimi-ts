import { KirimiApiError, KirimiError, KirimiTimeoutError } from './errors.ts';
import type {
  BroadcastMessageOptions,
  ConnectDeviceOptions,
  CreateDepositOptions,
  CreateDeviceOptions,
  DepositRefOptions,
  DeviceStatusOptions,
  GenerateOtpOptions,
  KirimiClientOptions,
  KirimiResponse,
  ListDepositsOptions,
  ListDevicesOptions,
  OtpReverseCreateOptions,
  OtpReverseStatusOptions,
  RenewDeviceOptions,
  SaveContactOptions,
  SaveContactsBulkOptions,
  SendMessageFastOptions,
  SendMessageFileOptions,
  SendMessageOptions,
  SendOtpV2Options,
  SendWabaMessageOptions,
  ValidateOtpOptions,
  VerifyOtpV2Options,
  WabaConversationsOptions,
  WabaReplyOptions,
  WabaSendOtpOptions,
  WabaTemplateSyncOptions,
  WabaVerifyOtpOptions,
} from './types.ts';

const DEFAULT_BASE_URL = 'https://api.kirimi.id';
const DEFAULT_TIMEOUT = 30_000;

/** Drop keys whose value is `undefined` so optional fields never reach the wire. */
function compact(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Client for the Kirimi API.
 *
 * @example
 * ```ts
 * import { KirimiClient } from '@kiriminow/sdk';
 *
 * const client = new KirimiClient({ userCode: 'USER', secret: 'SECRET' });
 * const resp = await client.sendMessage({ deviceId: 'DEV', receiver: '628xxx', message: 'halo' });
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
      body: JSON.stringify(compact(body)),
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
      receiver: opts.receiver,
      message: opts.message,
      media_url: opts.mediaUrl,
      fileName: opts.fileName,
      enableTypingEffect: opts.enableTypingEffect,
      typingSpeedMs: opts.typingSpeedMs,
      quotedMessageId: opts.quotedMessageId,
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
    form.append('receiver', opts.receiver);

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
    if (opts.fileName !== undefined) form.append('fileName', opts.fileName);
    if (opts.message !== undefined) form.append('message', opts.message);
    if (opts.caption !== undefined) form.append('caption', opts.caption);
    if (opts.quotedMessageId !== undefined) {
      form.append('quotedMessageId', opts.quotedMessageId);
    }

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
      receiver: opts.receiver,
      message: opts.message,
      media_url: opts.mediaUrl,
      fileName: opts.fileName,
      quotedMessageId: opts.quotedMessageId,
    });
  }

  /**
   * Broadcast a message to many recipients.
   * `numbers` must be an array — the API rejects a joined string.
   * @see https://api.kirimi.id/v1/broadcast-message
   */
  broadcastMessage<T = unknown>(
    opts: BroadcastMessageOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/broadcast-message', {
      ...this.auth(),
      device_id: opts.deviceId,
      label: opts.label,
      numbers: opts.numbers,
      message: opts.message,
      delay: opts.delay,
      delayMin: opts.delayMin,
      delayMax: opts.delayMax,
      media_url: opts.mediaUrl,
      fileName: opts.fileName,
      started_at: opts.startedAt,
      enableTypingEffect: opts.enableTypingEffect,
      typingSpeedMs: opts.typingSpeedMs,
    });
  }

  // ─── WABA ───────────────────────────────────────────────────────────────

  /**
   * Send a Meta-approved template via WhatsApp Business API.
   * @see https://api.kirimi.id/v1/waba/send-message
   */
  sendWabaMessage<T = unknown>(
    opts: SendWabaMessageOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/send-message', {
      ...this.auth(),
      waba_id: opts.wabaId,
      to: opts.to,
      template_name: opts.templateName,
      variables: opts.variables,
      header: opts.header,
      buttons: opts.buttons,
    });
  }

  /**
   * Send a free-form reply. Only allowed within 24h of the customer's last message.
   * @see https://api.kirimi.id/v1/waba/messages/reply
   */
  wabaReply<T = unknown>(opts: WabaReplyOptions): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/messages/reply', {
      ...this.auth(),
      waba_id: opts.wabaId,
      to: opts.to,
      message: opts.message,
    });
  }

  /**
   * List conversations still inside the 24h customer service window.
   * @see https://api.kirimi.id/v1/waba/conversations
   */
  wabaConversations<T = unknown>(
    opts?: WabaConversationsOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/conversations', {
      ...this.auth(),
      limit: opts?.limit,
      page: opts?.page,
    });
  }

  /**
   * Refresh template status from Meta for one WABA.
   * @see https://api.kirimi.id/v1/waba/templates/sync
   */
  wabaTemplatesSync<T = unknown>(
    opts: WabaTemplateSyncOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/templates/sync', {
      ...this.auth(),
      waba_id: opts.wabaId,
    });
  }

  /**
   * Send an OTP through your own WABA + AUTHENTICATION template.
   * @see https://api.kirimi.id/v1/waba/send-otp
   */
  wabaSendOtp<T = unknown>(
    opts: WabaSendOtpOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/send-otp', {
      ...this.auth(),
      waba_id: opts.wabaId,
      to: opts.to,
      template_name: opts.templateName,
    });
  }

  /**
   * Verify an OTP previously sent through `wabaSendOtp`.
   * @see https://api.kirimi.id/v1/waba/verify-otp
   */
  wabaVerifyOtp<T = unknown>(
    opts: WabaVerifyOtpOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/waba/verify-otp', {
      ...this.auth(),
      waba_id: opts.wabaId,
      to: opts.to,
      otp_code: opts.otpCode,
    });
  }

  // ─── Devices ────────────────────────────────────────────────────────────

  /**
   * Create a new device.
   * @see https://api.kirimi.id/v1/create-device
   */
  createDevice<T = unknown>(
    opts: CreateDeviceOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/create-device', {
      ...this.auth(),
      package_id: opts.packageId,
      voucher_code: opts.voucherCode,
    });
  }

  /**
   * Connect a device and obtain its QR/session state.
   * @see https://api.kirimi.id/v1/connect-device
   */
  connectDevice<T = unknown>(
    opts: ConnectDeviceOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/connect-device', {
      ...this.auth(),
      device_id: opts.deviceId,
    });
  }

  /**
   * Renew a device subscription.
   * @see https://api.kirimi.id/v1/renew-device
   */
  renewDevice<T = unknown>(
    opts: RenewDeviceOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/renew-device', {
      ...this.auth(),
      device_id: opts.deviceId,
      package_id: opts.packageId,
      voucher_code: opts.voucherCode,
    });
  }

  /**
   * List all devices associated with the account.
   * @see https://api.kirimi.id/v1/list-devices
   */
  listDevices<T = unknown>(
    opts?: ListDevicesOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-devices', {
      ...this.auth(),
      page: opts?.page,
      limit: opts?.limit,
    });
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
   * Save a contact to the account. Existing numbers are skipped, not overwritten.
   * @see https://api.kirimi.id/v1/save-contact
   */
  saveContact<T = unknown>(
    opts: SaveContactOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/save-contact', {
      ...this.auth(),
      nama: opts.nama,
      nomor: opts.nomor,
      device_id: opts.deviceId,
    });
  }

  /**
   * Save up to 1000 contacts in one request.
   * @see https://api.kirimi.id/v1/save-contacts-bulk
   */
  saveContactsBulk<T = unknown>(
    opts: SaveContactsBulkOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/save-contacts-bulk', {
      ...this.auth(),
      contacts: opts.contacts,
      device_id: opts.deviceId,
    });
  }

  // ─── OTP v1 ─────────────────────────────────────────────────────────────

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
      otp_length: opts.otpLength,
      otp_type: opts.otpType,
      customOtpText: opts.customOtpText,
      customOtpMessage: opts.customOtpMessage,
      enableTypingEffect: opts.enableTypingEffect,
      typingSpeedMs: opts.typingSpeedMs,
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

  // ─── OTP v2 ─────────────────────────────────────────────────────────────

  /**
   * Send an OTP through the Kirimi provider, your own device, or your own WABA.
   * @see https://api.kirimi.id/v2/otp/send
   */
  sendOtpV2<T = unknown>(opts: SendOtpV2Options): Promise<KirimiResponse<T>> {
    return this.post<T>('/v2/otp/send', {
      ...this.auth(),
      phone: opts.phone,
      method: opts.method,
      app_name: opts.appName,
      device_id: opts.deviceId,
      waba_id: opts.wabaId,
      template_name: opts.templateName,
      custom_message: opts.customMessage,
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

  // ─── OTP Reverse ────────────────────────────────────────────────────────

  /**
   * Create a reverse OTP token and the message the customer must send back.
   * @see https://api.kirimi.id/v2/otp-reverse/create
   */
  otpReverseCreate<T = unknown>(
    opts: OtpReverseCreateOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v2/otp-reverse/create', {
      ...this.auth(),
      phone: opts.phone,
      device_id: opts.deviceId,
      app_name: opts.appName,
      callback_url: opts.callbackUrl,
      custom_message: opts.customMessage,
      success_message: opts.successMessage,
      failure_message: opts.failureMessage,
    });
  }

  /**
   * Check the status of a reverse OTP token.
   * @see https://api.kirimi.id/v2/otp-reverse/status
   */
  otpReverseStatus<T = unknown>(
    opts: OtpReverseStatusOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v2/otp-reverse/status', {
      ...this.auth(),
      token: opts.token,
    });
  }

  // ─── Packages & Deposits ────────────────────────────────────────────────

  /**
   * List available packages.
   * @see https://api.kirimi.id/v1/list-packages
   */
  listPackages<T = unknown>(): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-packages', this.auth());
  }

  /**
   * Create a deposit payment link. Nominal minimum is 100.
   * @see https://api.kirimi.id/v1/create-deposit
   */
  createDeposit<T = unknown>(
    opts: CreateDepositOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/create-deposit', {
      ...this.auth(),
      nominal: opts.nominal,
    });
  }

  /**
   * Check a deposit's status by reference.
   * @see https://api.kirimi.id/v1/deposit-status
   */
  depositStatus<T = unknown>(
    opts: DepositRefOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/deposit-status', {
      ...this.auth(),
      ref: opts.ref,
    });
  }

  /**
   * Cancel an unpaid deposit.
   * @see https://api.kirimi.id/v1/cancel-deposit
   */
  cancelDeposit<T = unknown>(
    opts: DepositRefOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/cancel-deposit', {
      ...this.auth(),
      ref: opts.ref,
    });
  }

  /**
   * List deposits for the account.
   * @see https://api.kirimi.id/v1/list-deposits
   */
  listDeposits<T = unknown>(
    opts?: ListDepositsOptions,
  ): Promise<KirimiResponse<T>> {
    return this.post<T>('/v1/list-deposits', {
      ...this.auth(),
      page: opts?.page,
      limit: opts?.limit,
      status: opts?.status,
    });
  }
}
