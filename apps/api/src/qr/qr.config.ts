import { ServiceUnavailableException } from '@nestjs/common';
export function qrSigningSecret() {
  const secret =
    process.env.QR_SIGNING_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ServiceUnavailableException('QR is not configured');
  return secret;
}
