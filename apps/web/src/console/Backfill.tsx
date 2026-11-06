import { Select } from './Select';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, consoleApi, messageOf, type Account } from './client';
import { sessionsApi, type MeetupSession } from './sessions-api';
import {
  attendanceApi,
  type BackfillInput,
  type AttendanceResult,
} from './attendance-api';
import { Alert, BusyLabel, Dialog } from './Shared';
import { useText } from './i18n';
function yesterday() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const today = ['year', 'month', 'day']
    .map((k) => p.find((v) => v.type === k)!.value)
    .join('-');
  return new Date(Date.parse(today + 'T12:00Z') - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function Backfill({
  onClose,
  onSaved,
  onAuthError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onAuthError: (error: unknown) => void;
}) {
  const t = useText();
  const [date, setDate] = useState(yesterday),
    [time, setTime] = useState('12:00'),
    [sessionId, setSessionId] = useState(''),
    [userId, setUserId] = useState(''),
    [reason, setReason] = useState('');
  const [search, setSearch] = useState(''),
    [applied, setApplied] = useState(''),
    [sessionSearch, setSessionSearch] = useState(''),
    [sessionApplied, setSessionApplied] = useState('');
  const [sessions, setSessions] = useState<MeetupSession[]>([]),
    [users, setUsers] = useState<Account[]>([]),
    [sessionCursor, setSessionCursor] = useState<string>(),
    [userCursor, setUserCursor] = useState<string>(),
    [sessionNext, setSessionNext] = useState<string | null>(null),
    [userNext, setUserNext] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true),
    [loadingUsers, setLoadingUsers] = useState(true),
    [lookupError, setLookupError] = useState(''),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [operation, setOperation] = useState<{
      sessionId: string;
      body: BackfillInput;
    }>(),
    [result, setResult] = useState<AttendanceResult>();
  const sending = useRef(false),
    controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController();
    setLoadingSessions(true);
    setSessions([]);
    setSessionId('');
    setLookupError('');
    void sessionsApi
      .list(
        {
          from: date,
          to: date,
          search: sessionApplied,
          cursor: sessionCursor,
          limit: 20,
        },
        c.signal,
      )
      .then((r) => {
        setSessions(r.items);
        setSessionNext(r.nextCursor);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setLookupError(messageOf(e));
          onAuthError(e);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoadingSessions(false);
      });
    return () => c.abort();
  }, [date, sessionApplied, sessionCursor, revision, onAuthError]);
  useEffect(() => {
    const c = new AbortController();
    setLoadingUsers(true);
    setUsers([]);
    setUserId('');
    void consoleApi
      .accounts(
        { search: applied, cursor: userCursor, enabled: true, limit: 20 },
        c.signal,
      )
      .then((r) => {
        setUsers(r.items);
        setUserNext(r.nextCursor);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setLookupError(messageOf(e));
          onAuthError(e);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoadingUsers(false);
      });
    return () => c.abort();
  }, [applied, userCursor, revision, onAuthError]);
  async function save(op: { sessionId: string; body: BackfillInput }) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setOperation(op);
    const c = new AbortController();
    controller.current = c;
    try {
      const saved = await attendanceApi.backfill(
        op.sessionId,
        op.body,
        c.signal,
      );
      if (!c.signal.aborted) {
        setResult(saved);
        setOperation(undefined);
        onSaved();
      }
    } catch (e) {
      if (!c.signal.aborted) {
        setError(messageOf(e));
        onAuthError(e);
        if (
          e instanceof ApiError &&
          e.status >= 400 &&
          e.status < 500 &&
          e.status !== 408 &&
          e.status !== 429
        )
          setOperation(undefined);
      }
    } finally {
      sending.current = false;
      if (!c.signal.aborted) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (operation || sending.current) return;
    const occurredAt = new Date(`${date}T${time}:00+06:30`);
    if (!Number.isFinite(occurredAt.valueOf())) return;
    void save({
      sessionId,
      body: {
        requestId: crypto.randomUUID(),
        userId,
        occurredAt: occurredAt.toISOString(),
        reason: reason.trim(),
      },
    });
  }
  return (
    <Dialog title={t('Backfill attendance')} onClose={onClose} busy={busy}>
      <p>
        {t(
          'Record actual historical attendance. One available visit is deducted only after confirmation.',
        )}
      </p>
      {error && <Alert>{t(error)}</Alert>}
      {result ? (
        <>
          <Alert success>
            {t(
              result.outcome === 'CHECKED_IN'
                ? 'Backfill saved'
                : result.outcome === 'CANCELLED'
                  ? 'Original attendance was cancelled'
                  : 'Already checked in',
            )}
          </Alert>
          <dl className="c-backfill-result">
            <dt>{t('Member')}</dt>
            <dd>
              {result.member.name} · {result.member.memberNumber}
            </dd>
            <dt>{t('Plan / session')}</dt>
            <dd>
              {result.plan.name} · {result.session.name}
            </dd>
            <dt>{t('Attendance time')}</dt>
            <dd>
              {new Intl.DateTimeFormat(undefined, {
                timeZone: 'Asia/Yangon',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(result.checkedInAt))}{' '}
              · Asia/Yangon
            </dd>
            <dt>{t('Remaining visits')}</dt>
            <dd>{result.membership.remainingVisits}</dd>
          </dl>
          <p>{t('Duplicate requests do not deduct another visit.')}</p>
          <button className="c-button primary" onClick={onClose}>
            {t('Done')}
          </button>
        </>
      ) : (
        <form className="c-form" onSubmit={submit}>
          {lookupError && (
            <Alert>
              {t(lookupError)}{' '}
              <button
                type="button"
                className="c-button secondary"
                disabled={!!operation || busy}
                onClick={() => setRevision((v) => v + 1)}
              >
                {t('Retry')}
              </button>
            </Alert>
          )}
          <fieldset
            disabled={busy || !!operation}
            className="c-backfill-fields"
          >
            <label>
              {t('Meetup date')}
              <input
                aria-label={t('Meetup date')}
                type="date"
                required
                max={yesterday()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSessionCursor(undefined);
                }}
              />
            </label>
            <label>
              {t('Search sessions')}
              <input
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                maxLength={120}
              />
            </label>
            <div>
              <button
                type="button"
                className="c-button secondary"
                onClick={() => {
                  setSessionApplied(sessionSearch.trim());
                  setSessionCursor(undefined);
                }}
              >
                {t('Find sessions')}
              </button>{' '}
              <button
                type="button"
                className="c-button secondary"
                disabled={!sessionNext || loadingSessions}
                onClick={() => setSessionCursor(sessionNext!)}
              >
                {t('More sessions')}
              </button>
            </div>
            <label>
              {t('Session')}
              <Select
                aria-label={t('Session')}
                required
                disabled={loadingSessions}
                value={sessionId}
                onValueChange={(value) => setSessionId(value)}
              >
                <option value="">
                  {t(loadingSessions ? 'Loading…' : 'Choose a session')}
                </option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.plan.name} · {s.meetupDate}
                  </option>
                ))}
              </Select>
            </label>
            {!loadingSessions && !sessions.length && (
              <p role="status">
                {t(
                  'No sessions found for this date. Adjust the date or search.',
                )}
              </p>
            )}
            <label>
              {t('Search accounts')}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={120}
              />
            </label>
            <div>
              <button
                type="button"
                className="c-button secondary"
                onClick={() => {
                  setApplied(search.trim());
                  setUserCursor(undefined);
                }}
              >
                {t('Find accounts')}
              </button>{' '}
              <button
                type="button"
                className="c-button secondary"
                disabled={!userNext || loadingUsers}
                onClick={() => setUserCursor(userNext!)}
              >
                {t('More accounts')}
              </button>
            </div>
            <label>
              {t('Member')}
              <Select
                aria-label={t('Member')}
                required
                disabled={loadingUsers}
                value={userId}
                onValueChange={(value) => setUserId(value)}
              >
                <option value="">
                  {t(loadingUsers ? 'Loading…' : 'Choose an account')}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.phone}
                  </option>
                ))}
              </Select>
            </label>
            {!loadingUsers && !users.length && (
              <p role="status">{t('No accounts match this search.')}</p>
            )}
            <label>
              {t('Attendance time (Myanmar)')}
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <label>
              {t('Reason')}
              <textarea
                required
                minLength={1}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p>
              {t(
                'Eligibility uses the selected historical date and current remaining visits. Closed sessions are allowed.',
              )}
            </p>
          </fieldset>
          {operation && (
            <Alert>
              {t(
                'Result not confirmed. Retry the same backfill to avoid recording it twice.',
              )}
            </Alert>
          )}
          <div className="c-dialog-actions">
            <button
              type="button"
              className="c-button secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t('Close')}
            </button>
            {operation ? (
              <button
                type="button"
                className="c-button primary"
                disabled={busy}
                onClick={() => void save(operation)}
              >
                <BusyLabel busy={busy}>{t('Retry same backfill')}</BusyLabel>
              </button>
            ) : (
              <button
                className="c-button primary"
                disabled={
                  busy ||
                  loadingSessions ||
                  loadingUsers ||
                  !sessionId ||
                  !userId ||
                  !reason.trim()
                }
              >
                <BusyLabel busy={busy}>{t('Save backfill')}</BusyLabel>
              </button>
            )}
          </div>
        </form>
      )}
    </Dialog>
  );
}
