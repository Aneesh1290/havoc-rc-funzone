import crypto from 'crypto';
import { getSiteSetting } from './db';

// UAT Default Credentials (from bank integration pack)
const UAT_MERCHANT_ID = '100000000007164';
const UAT_AGGREGATOR_ID = 'A100000000007164';
const UAT_SECRET_KEY = 'db06cca0-838b-4e01-8b20-6ac446ffb6bd';

// Production Credentials (Havoc Hobby Center Private Limited)
const PROD_MERCHANT_ID = '100000000553470';
const PROD_AGGREGATOR_ID = '100000000553469';
const PROD_SECRET_KEY = '863edfb6-97c3-4944-b7d8-021fd7248037';

export function getIciciEnv(): string {
  const env = getSiteSetting('payment_gateway_env', process.env.ICICI_ENV || 'live');
  return env.toLowerCase();
}

export function isIciciUat(): boolean {
  const env = getIciciEnv();
  return env === 'uat' || env === 'test' || env === 'sandbox';
}

export function getIciciMerchantId(): string {
  const defaultMid = isIciciUat() ? UAT_MERCHANT_ID : (process.env.ICICI_MERCHANT_ID || PROD_MERCHANT_ID);
  return getSiteSetting('icici_merchant_id', defaultMid);
}

export function getIciciAggregatorId(): string {
  const defaultAgg = isIciciUat() ? UAT_AGGREGATOR_ID : (process.env.ICICI_AGGREGATOR_ID || PROD_AGGREGATOR_ID);
  return getSiteSetting('icici_aggregator_id', defaultAgg);
}

export function getIciciSecretKey(): string {
  const defaultKey = isIciciUat() ? UAT_SECRET_KEY : (process.env.ICICI_SECRET_KEY || PROD_SECRET_KEY);
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

/**
 * Initiates a server-to-server refund request to ICICI Bank Direct PG (application/x-www-form-urlencoded).
 */
export async function processIciciRefund(params: {
  originalTxnNo: string;
  refundAmount: number;
  refundTxnNo?: string;
  reason?: string;
}): Promise<{
  success: boolean;
  responseCode?: string;
  description?: string;
  refundTxnId?: string;
  data?: any;
}> {
  const merchantTxnNo = (params.refundTxnNo || `REF_${Date.now().toString().slice(-10)}`).slice(0, 20);
  const aggregatorId = getIciciAggregatorId();

  const payload: Record<string, string> = {
    merchantId: getIciciMerchantId(),
    transactionType: "REFUND",
    merchantTxnNo: merchantTxnNo,
    originalTxnNo: params.originalTxnNo,
    amount: Number(params.refundAmount).toFixed(2),
  };

  if (aggregatorId) {
    payload.aggregatorID = aggregatorId;
  }
  if (params.reason) {
    payload.addlParam1 = params.reason.slice(0, 64);
  }

  payload.secureHash = generateIciciHash(payload);

  const formParams = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    formParams.append(key, value);
  }

  const res = await fetch(getIciciCommandUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formParams.toString()
  });

  const data = await res.json().catch(() => ({}));

  // ICICI returns R1000, 0000, or 000 for successful operations
  const isSuccess = data.responseCode === "R1000" || data.responseCode === "0000" || data.responseCode === "000";

  return {
    success: isSuccess,
    responseCode: data.responseCode,
    description: data.respDescription || data.responseDescription,
    refundTxnId: data.txnID || data.paymentID || merchantTxnNo,
    data
  };
}



