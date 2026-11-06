export type Role = 'admin' | 'staff' | 'member';
export type Identity = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  mustChangePassword: boolean;
};
export type Account = Identity & { enabled: boolean };
export type Directory = { items: Account[]; nextCursor: string | null };
export type Summary = {
  total: number;
  enabled: number;
  staff: number;
  passwordChangesRequired: number;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
  /\/$/,
  '',
);
export async function call<T>(
  path: string,
  options: { method?: string; body?: object; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      ...(options.body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options.body),
          }
        : {}),
    });
    const data = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error;
      return {};
    });
    if (!response.ok) {
      const code = typeof data.code === 'string' ? data.code : 'REQUEST_FAILED';
      const fallback: Record<number, string> = {
        400: 'Check the information you entered.',
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to do that.',
        409: 'This conflicts with the current account. Please refresh and try again.',
        429: 'Too many attempts. Please wait a moment and try again.',
        503: 'The service is temporarily unavailable. Please try again.',
      };
      const domainMessages: Record<string, string> = {
        INVALID_MEMBER_ROLE:
          'Memberships can only be assigned or renewed for member accounts.',
        BACKFILL_DATE_INVALID:
          'Backfill requires a historical session and matching attendance date in Myanmar time.',
        INVALID_QR: 'This QR is invalid or has been replaced.',
        ACCOUNT_DISABLED: 'This account cannot check in.',
        SESSION_CLOSED: 'This session is closed.',
        SESSION_DATE_MISMATCH:
          'Live check-in is only available on the meetup date.',
        NO_ELIGIBLE_MEMBERSHIP: 'No eligible membership for this session.',
        VISITS_EXHAUSTED: 'No visits remain for this membership.',
        IDEMPOTENCY_CONFLICT:
          'This request ID was already used for a different operation.',
        ATTENDANCE_OUTSIDE_PERIOD:
          'The period cannot exclude existing attendance.',

        INVALID_STAFF:
          'Choose enabled staff accounts only. Clear unavailable staff and refresh the staff list.',
        MEMBERSHIP_OVERLAP:
          'This member already has an overlapping period for this plan.',
        PLAN_CHANGED:
          'The plan changed. Close this dialog, refresh and review its quota.',
        PLAN_ARCHIVED: 'This plan is archived. Choose an available plan.',
        VERSION_CONFLICT:
          'This record changed. Close this dialog and refresh before editing.',
        QUOTA_BELOW_USED:
          'Total visits cannot be lower than visits already used.',
        INVALID_STATE:
          'This account or membership is not eligible for this change.',
      };
      throw new ApiError(
        response.status,
        code,
        code === 'PASSWORD_CHANGE_REQUIRED'
          ? 'Change your temporary password to continue.'
          : domainMessages[code] ||
              fallback[response.status] ||
              'Something went wrong. Please try again.',
      );
    }
    return data as T;
  } catch (error) {
    if (options.signal?.aborted)
      throw new DOMException('Aborted', 'AbortError');
    if (error instanceof ApiError) throw error;
    if (timedOut)
      throw new ApiError(
        0,
        'REQUEST_TIMEOUT',
        options.method && options.method !== 'GET'
          ? 'The request timed out. Check whether your change was saved before trying again.'
          : 'The request took too long. Please try again.',
      );
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot connect. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
export const consoleApi = {
  signup: (body: { name: string; phone: string; password: string }) =>
    call<{ user: Identity }>('/auth/signup', { method: 'POST', body }),
  session: (signal?: AbortSignal) =>
    call<{ user: Identity }>('/auth/session', { signal }),
  login: (phone: string, password: string) =>
    call<{ user: Identity }>('/auth/login', {
      method: 'POST',
      body: { phone, password },
    }),
  logout: () => call('/auth/logout', { method: 'POST' }),
  summary: (signal?: AbortSignal) =>
    call<Summary>('/admin/users/summary', { signal }),
  accounts: (
    query: {
      search?: string;
      cursor?: string;
      limit?: number;
      role?: string;
      enabled?: boolean;
    },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ limit: String(query.limit || 15) });
    if (query.role) params.set('role', query.role);
    if (query.enabled !== undefined)
      params.set('enabled', String(query.enabled));
    if (query.search) params.set('search', query.search);
    if (query.cursor) params.set('cursor', query.cursor);
    return call<Directory>(`/admin/users?${params}`, { signal });
  },
  create: (body: {
    name: string;
    phone: string;
    temporaryPassword: string;
    role: 'member' | 'staff';
  }) =>
    call<{ user: Account; created: boolean }>('/admin/users', {
      method: 'POST',
      body,
    }),
  reset: (id: string, temporaryPassword: string, reason: string) =>
    call(`/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: { temporaryPassword, reason, identityVerified: true },
    }),
  access: (
    id: string,
    enabled: boolean,
    role: 'member' | 'staff',
    reason: string,
  ) =>
    call<{ user: Account }>(`/admin/users/${encodeURIComponent(id)}/access`, {
      method: 'PATCH',
      body: { enabled, role, reason },
    }),
  password: (currentPassword: string, newPassword: string) =>
    call('/account/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Please try again.';
