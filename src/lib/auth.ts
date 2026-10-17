import crypto from 'crypto';

const AUTH_COOKIE_NAME = 'havoc_admin_auth';
const JWT_SECRET = process.env.AUTH_SECRET || 'havoc-rc-secure-admin-token-secret-key-2026';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  exp: number; // expiration unix timestamp in seconds
}

export function signToken(payload: Omit<TokenPayload, 'exp'>, expiresInSeconds: number = 60 * 60 * 24 * 7): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: TokenPayload = { ...payload, exp };
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify cryptographic HMAC signature using timing-safe comparison to prevent timing attacks
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    // Check expiration timestamp
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

export { AUTH_COOKIE_NAME };
