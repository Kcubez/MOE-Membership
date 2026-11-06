import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
export type QrCredential = {
  userId: string;
  credentialId: string;
  version: number;
};
const prefix = 'moe:member:v1:';
function signature(row: QrCredential, secret: string) {
  const key = Buffer.from(
    hkdfSync('sha256', secret, 'moe-membership', 'personal-qr-signing-v1', 32),
  );
  return createHmac('sha256', key)
    .update(JSON.stringify([row.credentialId, row.userId, row.version]))
    .digest();
}
export function qrPayload(row: QrCredential, secret: string) {
  return (
    prefix +
    row.credentialId +
    ':' +
    signature(row, secret).toString('base64url')
  );
}
export function qrLookupId(payload: string): string | null {
  const match =
    /^moe:member:v1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([A-Za-z0-9_-]{43})$/.exec(
      payload,
    );
  return match?.[1] || null;
}
// The future attendance transaction must load this current credential by lookup ID,
// lock it against rotation, verify it, and independently check actor/eligibility.
export function qrMatches(payload: string, row: QrCredential, secret: string) {
  if (qrLookupId(payload) !== row.credentialId) return false;
  const supplied = Buffer.from(
    payload.slice(payload.lastIndexOf(':') + 1),
    'base64url',
  );
  const expected = signature(row, secret);
  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected) &&
    payload === qrPayload(row, secret)
  );
}
