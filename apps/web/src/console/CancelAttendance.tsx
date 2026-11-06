import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  attendanceApi,
  type AttendanceRecord,
  type CancellationResult,
} from './attendance-api';
import { ApiError, messageOf } from './client';
import { Alert, BusyLabel, Dialog } from './Shared';
import { useText } from './i18n';
export function CancelAttendance({
  item,
  onClose,
  onSaved,
  onAuthError,
}: {
  item: AttendanceRecord;
  onClose: () => void;
  onSaved: () => void;
  onAuthError: (error: unknown) => void;
}) {
  const t = useText();
  const [reason, setReason] = useState(''),
    [pendingReason, setPendingReason] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<CancellationResult>();
  const sending = useRef(false),
    controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  const time = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: 'Asia/Yangon',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  async function save(value: string) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setPendingReason(value);
    const c = new AbortController();
    controller.current = c;
    try {
      const saved = await attendanceApi.cancel(item.id, value, c.signal);
      if (!c.signal.aborted) {
        setResult(saved);
        setPendingReason(undefined);
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
          setPendingReason(undefined);
      }
    } finally {
      sending.current = false;
      if (!c.signal.aborted) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (pendingReason !== undefined || !reason.trim()) return;
    void save(reason.trim());
  }
  return (
    <Dialog title={t('Cancel attendance')} onClose={onClose} busy={busy}>
      <dl className="c-backfill-result">
        <dt>{t('Member')}</dt>
        <dd>
          {item.member.name} · {item.member.memberNumber}
        </dd>
        <dt>{t('Plan / session')}</dt>
        <dd>
          {item.plan.name} · {item.session.name}
        </dd>
        <dt>{t('Attendance time')}</dt>
        <dd>{time(item.occurredAt)} · Asia/Yangon</dd>
      </dl>
      {error && <Alert>{t(error)}</Alert>}
      {result ? (
        <>
          <Alert success>
            {t(
              result.outcome === 'CANCELLED'
                ? 'Attendance cancelled'
                : 'Already cancelled',
            )}
          </Alert>
          <p>
            {t(
              result.refundApplied
                ? 'One visit was restored to the original membership.'
                : 'Previously cancelled. No additional visit was restored.',
            )}
          </p>
          <dl className="c-backfill-result">
            <dt>{t('Reason')}</dt>
            <dd>{result.cancellation.reason}</dd>
            <dt>{t('Cancelled by')}</dt>
            <dd>
              {result.cancellation.by.name} · {time(result.cancellation.at)}
            </dd>
            <dt>{t('Remaining visits')}</dt>
            <dd>{result.membership.remainingVisits}</dd>
          </dl>
          <button type="button" className="c-button primary" onClick={onClose}>
            {t('Done')}
          </button>
        </>
      ) : (
        <form className="c-form" onSubmit={submit}>
          <p>
            {t(
              'Cancel this attendance and restore one visit to its original membership. The history will be retained.',
            )}
          </p>
          <p>
            {t(
              'Restoring a visit does not extend or reactivate an expired or cancelled membership.',
            )}
          </p>
          <label>
            {t('Cancellation reason')}
            <textarea
              aria-label={t('Cancellation reason')}
              required
              maxLength={500}
              disabled={busy || pendingReason !== undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {pendingReason !== undefined && (
            <Alert>
              {t(
                'Result not confirmed. Retry this cancellation; a visit can only be restored once.',
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
            {pendingReason !== undefined ? (
              <button
                type="button"
                className="c-button danger"
                disabled={busy}
                onClick={() => void save(pendingReason)}
              >
                <BusyLabel busy={busy}>{t('Retry cancellation')}</BusyLabel>
              </button>
            ) : (
              <button
                type="submit"
                className="c-button danger"
                disabled={busy || !reason.trim()}
              >
                <BusyLabel busy={busy}>{t('Confirm cancellation')}</BusyLabel>
              </button>
            )}
          </div>
        </form>
      )}
    </Dialog>
  );
}
