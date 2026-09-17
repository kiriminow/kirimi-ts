/**
 * @module
 * Kirimi SDK — TypeScript client for the Kirimi WhatsApp API.
 *
 * @example
 * ```ts
 * import { KirimiClient } from '@kiriminow/sdk';
 *
 * const client = new KirimiClient({ userCode: 'USER', secret: 'SECRET' });
 * const resp = await client.sendMessage({ deviceId: 'DEV', receiver: '628xxx', message: 'halo' });
 * console.log(resp.success);
 * ```
 */

export { KirimiClient } from './client.ts';
export type {
  BroadcastMessageOptions,
  BulkContact,
  ConnectDeviceOptions,
  CreateDepositOptions,
  CreateDeviceOptions,
  DepositRefOptions,
  DepositStatus,
  DeviceStatusOptions,
  GenerateOtpOptions,
  KirimiClientOptions,
  KirimiResponse,
  ListDepositsOptions,
  ListDevicesOptions,
  OtpReverseCreateOptions,
  OtpReverseStatusOptions,
  OtpType,
  OtpV2Method,
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
  WabaReplyMessage,
  WabaReplyOptions,
  WabaSendOtpOptions,
  WabaTemplateHeader,
  WabaTemplateSyncOptions,
  WabaVerifyOtpOptions,
} from './types.ts';
export { KirimiError, KirimiApiError, KirimiTimeoutError } from './errors.ts';
