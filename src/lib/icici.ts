import crypto from 'crypto';
import { getSiteSetting } from './db';

// UAT Default Credentials (from bank integration pack)
const UAT_MERCHANT_ID = '100000000007164';
const UAT_AGGREGATOR_ID = 'A100000000007164';
const UAT_SECRET_KEY = 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';

export function getIciciEnv(): string {
  const env = getSiteSetting('payment_gateway_env', process.env.ICICI_ENV || 'test');
  return env.toLowerCase();
}

export function isIciciUat(): boolean {
  const env = getIciciEnv();
  return env === 'uat' || env === 'test' || env === 'sandbox';
}

export function getIciciMerchantId(): string {
  const defaultMid = isIciciUat() ? UAT_MERCHANT_ID : (process.env.ICICI_MERCHANT_ID || '100000000531583');
  return getSiteSetting('icici_merchant_id', defaultMid);
}

export function getIciciAggregatorId(): string {
  const defaultAgg = isIciciUat() ? UAT_AGGREGATOR_ID : (process.env.ICICI_AGGREGATOR_ID || '100000000531582');
  return getSiteSetting('icici_aggregator_id', defaultAgg);
}

export function getIciciSecretKey(): string {
  const defaultKey = isIciciUat() ? UAT_SECRET_KEY : (process.env.ICICI_SECRET_KEY || '9927ca2f-17bd-401d-8ae4-c34f5ea641bc');
  return getSiteSetting('icici_secret_key', defaultKey);
}

export function getIciciBaseUrl(): string {
  return isIciciUat() 
    ? 'https://pgpayuat.icicibank.com/tsp/pg/api' 
    : 'https://pgpay.icicibank.com/pg/api';
}

export function getIciciInitiateSaleUrl(): string {
  return `${getIciciBaseUrl()}/v2/initiateSale`;
}

export function getIciciCommandUrl(): string {
  return `${getIciciBaseUrl()}/command`;
}

export function getIciciSettlementDetailsUrl(): string {
  return `${getIciciBaseUrl()}/settlementDetails`;
}

/**
 * Computes HMAC-SHA256 signature across all non-null, non-undefined, non-empty payload keys
 * in alphabetical order, omitting `secureHash`.
 */
export function generateIciciHash(payload: Record<string, any>, customSecret?: string): string {
  const secret = customSecret || getIciciSecretKey();
  const sortedKeys = Object.keys(payload).sort();
  let plainText = "";
  for (const key of sortedKeys) {
    if (key !== 'secureHash' && payload[key] !== null && payload[key] !== undefined && payload[key] !== '') {
      plainText += String(payload[key]);
    }
  }
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(plainText);
  return hmac.digest('hex');
}


