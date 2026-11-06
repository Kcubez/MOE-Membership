import { call } from './client';
export type AttendanceResult = {
  outcome: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'CANCELLED';
  replayed: boolean;
  attendanceId: string;
  checkedInAt: string;
  member: { name: string; memberNumber: string };
  plan: { id: string; name: string };
  session: { id: string; name: string; meetupDate: string };
  membership: {
    id: string;
    totalVisits: number;
    usedVisits: number;
    remainingVisits: number;
  };
};
export type BackfillInput = {
  requestId: string;
  userId: string;
  occurredAt: string;
  reason: string;
};
export type CancellationResult = {
  outcome: 'CANCELLED' | 'ALREADY_CANCELLED';
  attendanceId: string;
  refundApplied: boolean;
  cancellation: {
    at: string;
    reason: string;
    by: { id: string; name: string };
  };
  membership: {
    id: string;
    totalVisits: number;
    usedVisits: number;
    remainingVisits: number;
  };
};
export const attendanceApi = {
  cancel: (id: string, reason: string, signal?: AbortSignal) =>
    call<CancellationResult>(
      `/admin/attendance/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: { reason }, signal },
    ),
  backfill: (id: string, body: BackfillInput, signal?: AbortSignal) =>
    call<AttendanceResult>(
      `/admin/sessions/${encodeURIComponent(id)}/attendance/backfill`,
      { method: 'POST', body, signal },
    ),
};

export type AttendanceRecord = {
  id: string;
  membershipId: string;
  occurredAt: string;
  recordedAt: string;
  method: 'scan' | 'backfill';
  status: 'effective' | 'cancelled';
  member: { id: string; name: string; memberNumber: string };
  plan: { id: string; name: string };
  session: { id: string; name: string; meetupDate: string };
  recordedBy: { id: string; name: string };
  cancellation: {
    at: string;
    reason: string;
    by: { id: string; name: string };
  } | null;
};
