import { call } from './client';
export type Plan = {
  id: string;
  name: string;
  description: string;
  benefits: string;
  totalVisits: number;
  archived: boolean;
  trashedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: { memberships: number; meetupSessions?: number };
};
export type Membership = {
  id: string;
  userId: string;
  planId: string;
  startDate: string;
  endDate: string;
  totalVisits: number;
  usedVisits: number;
  remainingVisits: number;
  version: number;
  status: 'Cancelled' | 'Completed' | 'Expired' | 'Upcoming' | 'Active';
  cancelledAt: string | null;
  cancellationReason: string | null;
  renewedFromId: string | null;
  user: {
    id: string;
    name: string;
    phone: string;
    profile: { memberNumber: number } | null;
  };
  plan: Plan;
};
export type Audit = {
  id: string;
  actorName: string;
  action: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type PlanInput = {
  name: string;
  description: string;
  benefits: string;
  totalVisits: number;
  reason: string;
};
function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}
export const catalogApi = {
  plans: (
    values: {
      search?: string;
      cursor?: string;
      archived?: string;
      trash?: string;
      limit?: number;
    },
    signal?: AbortSignal,
  ) =>
    call<Page<Plan>>(`/admin/plans?${query({ limit: 20, ...values })}`, {
      signal,
    }),
  createPlan: (body: PlanInput) =>
    call<Plan>('/admin/plans', { method: 'POST', body }),
  editPlan: (id: string, body: PlanInput & { version: number }) =>
    call<Plan>(`/admin/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    }),
  availability: (plan: Plan, reason: string) =>
    call<Plan>(`/admin/plans/${encodeURIComponent(plan.id)}/availability`, {
      method: 'PATCH',
      body: { archived: !plan.archived, version: plan.version, reason },
    }),
  planTrash: (
    plan: Plan,
    action: 'move' | 'restore' | 'delete',
    reason: string,
  ) =>
    call<{ success: boolean }>(
      `/admin/plans/${encodeURIComponent(plan.id)}/trash`,
      {
        method: 'PATCH',
        body: { action, version: plan.version, reason },
      },
    ),
  memberships: (
    values: {
      search?: string;
      cursor?: string;
      status?: string;
      planId?: string;
      limit?: number;
    },
    signal?: AbortSignal,
  ) =>
    call<Page<Membership>>(
      `/admin/memberships?${query({ limit: 15, ...values })}`,
      { signal },
    ),
  assign: (body: {
    userId: string;
    planId: string;
    planVersion: number;
    startDate: string;
    endDate: string;
    reason: string;
  }) => call<Membership>('/admin/memberships', { method: 'POST', body }),
  edit: (
    item: Membership,
    body: {
      startDate: string;
      endDate: string;
      totalVisits: number;
      reason: string;
    },
  ) =>
    call<Membership>(`/admin/memberships/${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      body: { ...body, version: item.version },
    }),
  renew: (
    item: Membership,
    body: { startDate: string; endDate: string; reason: string },
  ) =>
    call<Membership>(
      `/admin/memberships/${encodeURIComponent(item.id)}/renew`,
      { method: 'POST', body: { ...body, planVersion: item.plan.version } },
    ),
  cancel: (item: Membership, reason: string) =>
    call<Membership>(
      `/admin/memberships/${encodeURIComponent(item.id)}/cancel`,
      { method: 'POST', body: { version: item.version, reason } },
    ),
  audit: (
    kind: 'plans' | 'memberships' | 'sessions',
    id: string,
    signal?: AbortSignal,
  ) =>
    call<{ items: Audit[] }>(`/admin/${kind}/${encodeURIComponent(id)}/audit`, {
      signal,
    }),
};
