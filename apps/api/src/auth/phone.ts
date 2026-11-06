import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
export function normalizePhone(value: string): string {
  const parsed = parsePhoneNumberFromString(value.trim(), 'MM');
  if (!parsed || parsed.country !== 'MM' || !parsed.isValid())
    throw new Error('Use a valid Myanmar phone number');
  return parsed.number;
}
// Internal credential identifier only. No mail is sent and no email UI is exposed.
export function phoneIdentity(phone: string) {
  return `${phone.slice(1)}@phone.moe.invalid`;
}
