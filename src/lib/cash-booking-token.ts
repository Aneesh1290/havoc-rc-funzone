import crypto from "crypto";

/**
 * Generates a random secure hexadecimal token for cash walk-in sessions.
 */
export function generateCashWalkinToken(): string {
  return "cw_" + crypto.randomBytes(16).toString("hex");
}
