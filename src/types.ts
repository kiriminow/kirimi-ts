/**
 * Option types for every KirimiClient method.
 *
 * Field names mirror the canonical Kirimi API contract. Input-only conveniences
 * (e.g. `phone` as an alias for `receiver`) are documented per option and
 * resolved to the canonical field before the request is sent.
 */

export interface KirimiClientOptions {
  /** Your Kirimi user code */
  userCode: string;
  /** Your Kirimi secret key */
  secret: string;
  /** API base URL. Defaults to 'https://api.kirimi.id' */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 */
  timeout?: number;
  /**
   * Custom fetch implementation. Useful for testing or environments
   * that require a custom fetch (e.g., with proxy support).
   */
  fetch?: typeof fetch;
}

/**
 * Standard response envelope returned by the Kirimi API.
 */
export interface KirimiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message?: string;
}

/** Chat message payload for free-form WABA replies. */
export type WabaReplyMessage =
  | { type: 'text'; text: string }
  | {
      type: 'image' | 'audio' | 'video';
      media_url: string;
      caption?: string;
    }
  | {
      type: 'document';
      media_url: string;
      caption?: string;
      filename?: string;
    }
  | { type: 'interactive'; interactive: Record<string, unknown> };

/** Template header component for WABA template sends. */
export interface WabaTemplateHeader {
  type: 'document' | 'image' | 'video' | 'text';
  /** Media URL. Meta fetches it. */
  link?: string;
  /** Meta media handle, alternative to `link`. */
  id?: string;
  /** Document filename. Only used when `type` is `document`. */
  filename?: string;
  /** Header text. Only used when `type` is `text`. */
  text?: string;
}

/** A single recipient for a bulk contact save. */
export interface BulkContact {
  nama: string;
  nomor: string;
}

// ─── Auth & Device ─────────────────────────────────────────────────────────

export interface CreateDeviceOptions {
  /** Package ID for the new device */
  packageId: number | string;
  /** Optional discount voucher code */
  voucherCode?: string;
}

export interface ConnectDeviceOptions {
  deviceId: string;
}

export interface RenewDeviceOptions {
  deviceId: string;
  packageId: number | string;
  voucherCode?: string;
}

export interface DeviceStatusOptions {
  deviceId: string;
}

export interface ListDevicesOptions {
  page?: number;
  limit?: number;
}

// ─── WhatsApp Unofficial ───────────────────────────────────────────────────

export interface SendMessageOptions {
  deviceId: string;
  /** Recipient phone number, e.g. `6281234567890` */
  receiver: string;
  message: string;
  mediaUrl?: string;
  /** Custom media filename */
  fileName?: string;
  /** Simulate typing before sending. Defaults to true server-side */
  enableTypingEffect?: boolean;
  /** Typing speed in ms, 100–800. Defaults to 350 server-side */
  typingSpeedMs?: number;
  /** Message ID to quote/reply to */
  quotedMessageId?: string;
}

export interface SendMessageFastOptions {
  deviceId: string;
  /** Recipient phone number, e.g. `6281234567890` */
  receiver: string;
  message: string;
  mediaUrl?: string;
  fileName?: string;
  quotedMessageId?: string;
}

export interface SendMessageFileOptions {
  deviceId: string;
  /** Recipient phone number, e.g. `6281234567890` */
  receiver: string;
  /** File content as Blob, File, or raw bytes */
  file: Blob | File | Uint8Array;
  /** Filename sent both as the multipart filename and the `fileName` field */
  fileName?: string;
  /** Caption for the uploaded media */
  message?: string;
  caption?: string;
  quotedMessageId?: string;
}

export interface BroadcastMessageOptions {
  deviceId: string;
  /** Broadcast label for identification, max 100 chars */
  label: string;
  /** Recipient numbers. Max 1000 per request. */
  numbers: string[];
  message: string;
  /** Delay between messages in seconds. Server clamps to 30–3600. */
  delay?: number;
  /** Lower bound of the random delay in seconds. Min 30. */
  delayMin?: number;
  /** Upper bound of the random delay in seconds. Max 3600. */
  delayMax?: number;
  mediaUrl?: string;
  fileName?: string;
  /** Scheduled start time, ISO 8601 */
  startedAt?: string;
  enableTypingEffect?: boolean;
  typingSpeedMs?: number;
}

// ─── WABA ──────────────────────────────────────────────────────────────────

export interface SendWabaMessageOptions {
  /** WhatsApp Business Account ID. Not the device ID. */
  wabaId: string;
  /** Recipient phone number. Groups are not supported. */
  to: string;
  /** Meta-approved template name */
  templateName: string;
  /** Template body variables in order, for `{{1}}`, `{{2}}`, … */
  variables?: string[];
  /** Header component. Required for media or dynamic text headers. */
  header?: WabaTemplateHeader;
  /** Template button parameters */
  buttons?: unknown[];
}

export interface WabaReplyOptions {
  wabaId: string;
  /** The number that contacted you first. Groups are not supported. */
  to: string;
  message: WabaReplyMessage;
}

export interface WabaConversationsOptions {
  /** Page size, 1–200. Defaults to 50. */
  limit?: number;
  /** Page number, 1-based. Defaults to 1. */
  page?: number;
}

export interface WabaTemplateSyncOptions {
  wabaId: string;
}

export interface WabaSendOtpOptions {
  wabaId: string;
  /** Recipient phone number */
  to: string;
  /** AUTHENTICATION category template, APPROVED status */
  templateName: string;
}

export interface WabaVerifyOtpOptions {
  wabaId: string;
  to: string;
  otpCode: string;
}

// ─── OTP v2 ────────────────────────────────────────────────────────────────

export type OtpV2Method = 'whatsapp' | 'waba' | 'device' | 'waba_user';

export interface SendOtpV2Options {
  phone: string;
  /**
   * Delivery channel.
   * - `whatsapp` (alias `waba`) — official Kirimi provider, Rp 595 per delivered OTP
   * - `device` — your own connected WA device, free, requires `deviceId`
   * - `waba_user` — your own WABA + AUTHENTICATION template, requires `wabaId` and `templateName`
   */
  method?: OtpV2Method;
  /** Brand name shown in the OTP message. Defaults to "Kirimi.id" */
  appName?: string;
  deviceId?: string;
  wabaId?: string;
  templateName?: string;
  /** Custom message for `method: "device"`. Must contain `{{otp}}`, 10–500 chars. */
  customMessage?: string;
}

export interface VerifyOtpV2Options {
  phone: string;
  otpCode: string;
}

// ─── OTP Reverse ───────────────────────────────────────────────────────────

export interface OtpReverseCreateOptions {
  /** Customer phone number to verify */
  phone: string;
  /** Device that acts as the bot and detects the customer's message */
  deviceId: string;
  /** App name shown in the message. Defaults to "Kirimi.id" */
  appName?: string;
  /** URL notified when verification completes. Max 500 chars. */
  callbackUrl?: string;
  /** Must contain `{{token}}` and `{{phone}}`, 20–500 chars. */
  customMessage?: string;
  successMessage?: string;
  failureMessage?: string;
}

export interface OtpReverseStatusOptions {
  /** ULID token returned by `otpReverseCreate` */
  token: string;
}

// ─── OTP v1 ────────────────────────────────────────────────────────────────

export type OtpType = 'numeric' | 'alphabetic' | 'alphanumeric';

export interface GenerateOtpOptions {
  deviceId: string;
  phone: string;
  /** OTP length, 4–20. Defaults to 8 server-side. */
  otpLength?: number;
  /** OTP character set. Defaults to "numeric" server-side. */
  otpType?: OtpType;
  /** Custom OTP text, max 20 chars */
  customOtpText?: string;
  /** Custom message template. Must contain the `{otp}` placeholder. */
  customOtpMessage?: string;
  enableTypingEffect?: boolean;
  typingSpeedMs?: number;
}

export interface ValidateOtpOptions {
  deviceId: string;
  phone: string;
  otp: string;
}

// ─── Contacts ──────────────────────────────────────────────────────────────

export interface SaveContactOptions {
  /** Contact name. Sent as `nama`. */
  nama: string;
  /** Contact phone number. Sent as `nomor`. */
  nomor: string;
  deviceId?: string;
}

export interface SaveContactsBulkOptions {
  /** Contacts to save. Max 1000 per request. */
  contacts: BulkContact[];
  deviceId?: string;
}

// ─── Packages & Deposits ───────────────────────────────────────────────────

export type DepositStatus = 'unpaid' | 'paid' | 'expired' | 'cancelled';

export interface CreateDepositOptions {
  /** Deposit amount in IDR. Minimum 100. */
  nominal: number;
}

export interface DepositRefOptions {
  /** Deposit reference ID */
  ref: string;
}

export interface ListDepositsOptions {
  page?: number;
  limit?: number;
  status?: DepositStatus | '';
}
