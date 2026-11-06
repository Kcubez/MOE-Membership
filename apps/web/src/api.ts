import { call } from './console/client';
export type MemberProfile = {
  userId: string;
  memberNumber: string;
  name: string;
  phone: string;
  language: 'en' | 'my';
};
export async function getMyProfile(
  signal: AbortSignal,
): Promise<MemberProfile> {
  return call<MemberProfile>('/members/me', { signal });
}
