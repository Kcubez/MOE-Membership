import { call, type Role } from './client';
import type { Page } from './catalog';
export type MeetupSession = {
  id: string;
  name: string;
  planId: string;
  meetupDate: string;
  open: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  plan: { id: string; name: string; archived: boolean };
  staff?: { id: string; name: string; enabled: boolean; role: Role }[];
};
export type SessionInput = {
  name: string;
  planId: string;
  meetupDate: string;
  open: boolean;
  staffIds: string[];
  reason: string;
};
export const sessionsApi = {
  list: (
    values: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries({ limit: 20, ...values } as Record<
      string,
      string | number | undefined
    >))
      if (v !== undefined && v !== '') query.set(k, String(v));
    return call<Page<MeetupSession>>(`/sessions?${query}`, { signal });
  },
  create: (body: SessionInput) =>
    call<MeetupSession>('/admin/sessions', { method: 'POST', body }),
  state: (item: MeetupSession, reason: string) =>
    call<MeetupSession>(
      `/admin/sessions/${encodeURIComponent(item.id)}/state`,
      {
        method: 'PATCH',
        body: { open: !item.open, version: item.version, reason },
      },
    ),
  staff: (item: MeetupSession, staffIds: string[], reason: string) =>
    call<MeetupSession>(
      `/admin/sessions/${encodeURIComponent(item.id)}/staff`,
      { method: 'PUT', body: { staffIds, version: item.version, reason } },
    ),
};
