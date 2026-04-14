/**
 * Options for constructing a KirimiClient instance.
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

// ─── Method option types ───────────────────────────────────────────────────

export interface SendMessageOptions {
  deviceId: string;
  phone: string;
  message: string;
  mediaUrl?: string;
}

export interface SendMessageFileOptions {
  deviceId: string;
  phone: string;
  /** File content as Blob, File, or raw bytes */
  file: Blob | File | Uint8Array;
  /** Optional filename hint sent to the API */
  fileName?: string;
  message?: string;
}

export interface SendMessageFastOptions {
  deviceId: string;
  phone: string;
  message: string;
  mediaUrl?: string;
}

export interface SendWabaMessageOptions {
  deviceId: string;
  phone: string;
  message: string;
}

export interface DeviceStatusOptions {
  deviceId: string;
}

export interface SaveContactOptions {
  phone: string;
  name?: string;
  email?: string;
}

export interface GenerateOtpOptions {
  deviceId: string;
  phone: string;
  otpLength?: number;
  otpType?: 'numeric' | 'alphabetic' | 'alphanumeric';
  customOtpMessage?: string;
}

export interface ValidateOtpOptions {
  deviceId: string;
  phone: string;
  otp: string;
}

export interface SendOtpV2Options {
  phone: string;
  deviceId: string;
  method?: 'device' | 'waba';
  appName?: string;
  templateCode?: string;
  customMessage?: string;
}

export interface VerifyOtpV2Options {
  phone: string;
  otpCode: string;
}

export interface BroadcastMessageOptions {
  deviceId: string;
  /** One or more phone numbers. Arrays are joined with ',' */
  phones: string | string[];
  message: string;
  /** Delay between messages in seconds */
  delay?: number;
}

export interface ListDepositsOptions {
  status?: '' | 'paid' | 'unpaid' | 'expired';
}
