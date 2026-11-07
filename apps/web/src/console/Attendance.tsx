import { Select } from './Select';
import { Backfill } from './Backfill';
import { useEffect, useState, type FormEvent } from 'react';
import { call, messageOf } from './client';
import { Alert, Skeleton, BusyLabel } from './Shared';
import { Pager } from './CatalogShared';
import { useText } from './i18n';
import type { AttendanceRecord as RecordItem } from './attendance-api';
import { CancelAttendance } from './CancelAttendance';
type HistoryPage = { items: RecordItem[]; nextCursor: string | null };
const initial = { search: '', from: '', to: '', status: '', method: '' };
export function Attendance({
  isAdmin,
  onAuthError,
}: {
  isAdmin: boolean;
  onAuthError: (error: unknown) => void;
}) {
  const t = useText();
  const [backfill, setBackfill] = useState(false);
  const [cancelling, setCancelling] = useState<RecordItem>();
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial);
  const [data, setData] = useState<HistoryPage>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [page, setPage] = useState(0),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    const q = new URLSearchParams({ limit: '20' });
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    if (cursors[page]) q.set('cursor', cursors[page]!);
    void call<HistoryPage>(`/${isAdmin ? 'admin' : 'staff'}/attendance?${q}`, {
      signal: c.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(messageOf(e));
          onAuthError(e);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [filters, page, cursors, revision, onAuthError, isAdmin]);
  function apply(e: FormEvent) {
    e.preventDefault();
    setFilters({ ...draft, search: draft.search.trim() });
    setPage(0);
    setCursors([undefined]);
  }
  function time(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: 'Asia/Yangon',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Attendance history')}</h1>
          <p>
            {t(
              'Review check-ins and retained corrections. Dates use Myanmar time.',
            )}
          </p>
        </div>
        <button
          className="c-button secondary"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          <BusyLabel busy={loading}>{t('Refresh')}</BusyLabel>
        </button>
      </div>
      {isAdmin && (
        <div className="c-history-actions">
          <button
            className="c-button primary"
            onClick={() => setBackfill(true)}
          >
            {t('Backfill attendance')}
          </button>
        </div>
      )}
      {isAdmin && backfill && (
        <Backfill
          onClose={() => setBackfill(false)}
          onSaved={() => setRevision((v) => v + 1)}
          onAuthError={onAuthError}
        />
      )}
      {isAdmin && cancelling && (
        <CancelAttendance
          item={cancelling}
          onClose={() => setCancelling(undefined)}
          onSaved={() => setRevision((v) => v + 1)}
          onAuthError={onAuthError}
        />
      )}
      <section className="c-panel c-account-info">
        <form onSubmit={apply} className="c-history-filters">
          <label>
            {t('Search')}
            <input
              value={draft.search}
              maxLength={120}
              placeholder={t('Name, member number, plan or session')}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
            />
          </label>
          <label>
            {t('From date')}
            <input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            {t('To date')}
            <input
              type="date"
              min={draft.from || undefined}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <label>
            {t('Status')}
            <Select
              aria-label={t('Status')}
              value={draft.status}
              onValueChange={(value) => setDraft({ ...draft, status: value })}
            >
              <option value="">{t('All statuses')}</option>
              <option value="effective">{t('Effective')}</option>
              <option value="cancelled">{t('Cancelled')}</option>
            </Select>
          </label>
          <label>
            {t('Method')}
            <Select
              aria-label={t('Method')}
              value={draft.method}
              onValueChange={(value) => setDraft({ ...draft, method: value })}
            >
              <option value="">{t('All methods')}</option>
              <option value="scan">{t('Scan')}</option>
              <option value="backfill">{t('Backfill')}</option>
            </Select>
          </label>
          <button className="c-button primary" type="submit">
            {t('Apply filters')}
          </button>
          <button
            type="button"
            className="c-button secondary"
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setPage(0);
              setCursors([undefined]);
            }}
          >
            {t('Clear filters')}
          </button>
        </form>
        {error ? (
          <>
            <Alert>{t(error)}</Alert>
            <button
              className="c-button secondary"
              onClick={() => setRevision((v) => v + 1)}
            >
              {t('Retry')}
            </button>
          </>
        ) : loading ? (
          <Skeleton />
        ) : !data?.items.length ? (
          <p role="status">{t('No attendance matches these filters.')}</p>
        ) : (
          <>
            <div className="c-table-scroll">
              <table className="c-table">
                <thead>
                  <tr>
                    {[
                      'Member',
                      'Plan / session',
                      'Attendance time',
                      'Method',
                      'Status',
                      'Recorded by',
                      'Cancellation',
                      ...(isAdmin ? ['Actions'] : []),
                    ].map((x) => (
                      <th key={x}>{t(x)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.member.name}</strong>
                        <div>{r.member.memberNumber}</div>
                      </td>
                      <td>
                        {r.plan.name}
                        <div>{r.session.name}</div>
                        <small>{r.session.meetupDate}</small>
                      </td>
                      <td>
                        {time(r.occurredAt)}
                        <div>
                          <small>Asia/Yangon</small>
                        </div>
                      </td>
                      <td>{t(r.method === 'scan' ? 'Scan' : 'Backfill')}</td>
                      <td>
                        {t(
                          r.status === 'effective' ? 'Effective' : 'Cancelled',
                        )}
                      </td>
                      <td>
                        {r.recordedBy.name}
                        <div>
                          <small>{time(r.recordedAt)}</small>
                        </div>
                      </td>
                      <td>
                        {r.cancellation ? (
                          <>
                            {r.cancellation.reason}
                            <div>{r.cancellation.by.name}</div>
                            <small>{time(r.cancellation.at)}</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          {r.status === 'effective' ? (
                            <button
                              type="button"
                              className="c-button secondary small"
                              onClick={() => setCancelling(r)}
                              aria-label={`${t('Cancel attendance')}: ${r.member.name}, ${r.session.name}`}
                            >
                              {t('Cancel attendance')}
                            </button>
                          ) : (
                            <span>{t('Cancelled')}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              count={data.items.length}
              next={!!data.nextCursor}
              onPrevious={() => setPage((v) => v - 1)}
              onNext={() => {
                setCursors((v) => [...v.slice(0, page + 1), data.nextCursor!]);
                setPage((v) => v + 1);
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
