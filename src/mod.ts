/**
 * @module
 * Kirimi SDK — TypeScript client for the Kirimi WhatsApp API.
 *
 * @example
 * ```ts
 * import { KirimiClient } from '@kirimi/sdk';
 *
 * const client = new KirimiClient({ userCode: 'USER', secret: 'SECRET' });
 * const resp = await client.sendMessage({ deviceId: 'DEV', phone: '628xxx', message: 'halo' });
 * console.log(resp.success);
 * ```
 */

export { KirimiClient } from './client.ts';
export type {
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
export { KirimiError, KirimiApiError, KirimiTimeoutError } from './errors.ts';
