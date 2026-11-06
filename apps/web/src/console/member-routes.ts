export const memberRoutes = {
  overview: '/member',
  qr: '/member/qr',
  memberships: '/member/memberships',
  history: '/member/attendance',
  settings: '/member/settings',
} as const;
export type MemberSection = keyof typeof memberRoutes;
export function memberSection(path: string): MemberSection | undefined {
  return (Object.keys(memberRoutes) as MemberSection[]).find(
    (key) => memberRoutes[key] === path.replace(/\/+$/, ''),
  );
}
