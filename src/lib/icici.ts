import crypto from 'crypto';

export const ICICI_ENV = process.env.ICICI_ENV || 'live';
export const ICICI_MERCHANT_ID = process.env.ICICI_MERCHANT_ID || '100000000531583';
export const ICICI_AGGREGATOR_ID = process.env.ICICI_AGGREGATOR_ID || '100000000531582';
export const ICICI_SECRET_KEY = process.env.ICICI_SECRET_KEY || '9927ca2f-17bd-401d-8ae4-c34f5ea641bc';

export function getIciciBaseUrl(): string {
  return ICICI_ENV === 'live' 
    ? 'https://pgpay.icici.bank.in/pg/api' 
    : 'https://pgpayuat.icicibank.com/tsp/pg/api';
}

/**
 * Computes HMAC-SHA256 signature across all non-null, non-undefined payload keys
 * in alphabetical order, omitting `secureHash`.
 */
export function generateIciciHash(payload: Record<string, any>): string {
  const sortedKeys = Object.keys(payload).sort();
  let plainText = "";
  for (const key of sortedKeys) {
    if (key !== 'secureHash' && payload[key] !== null && payload[key] !== undefined) {
      plainText += String(payload[key]);
    }
  }
  const hmac = crypto.createHmac('sha256', ICICI_SECRET_KEY);
  hmac.update(plainText);
  return hmac.digest('hex');
}
