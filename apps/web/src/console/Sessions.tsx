import { Select } from './Select';
import { InlineLoading } from './Shared';
import { Spinner } from './Shared';
import { BusyLabel } from './Shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  PlusIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
  PersonIcon,
  ClockIcon,
} from '@radix-ui/react-icons';
import { sessionsApi, type MeetupSession } from './sessions-api';
import { catalogApi, type Plan, type Page } from './catalog';
import { consoleApi, messageOf, type Account } from './client';
import { Dialog, Alert, Skeleton } from './Shared';
import { Pager, AuditDialog, type CatalogProps } from './CatalogShared';
import { useText } from './i18n';
type Action =
  | { kind: 'create' }
  | { kind: 'staff' | 'state' | 'audit'; item: MeetupSession };
export function Sessions({
  admin,
  onAuthError,
  onNotice,
}: CatalogProps & { admin: boolean }) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [open, setOpen] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Page<MeetupSession>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [action, setAction] = useState<Action>();
  const reset = () => {
    setPage(0);
    setCursors([undefined]);
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void sessionsApi
      .list(
        { search: applied, open, from, to, cursor: cursors[page] },
        controller.signal,
      )
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(messageOf(error));
          onAuthError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applied, open, from, to, page, cursors, revision, onAuthError]);
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Meetup sessions')}</h1>
          <p>
            {t(
              admin
                ? 'Organise meetups and manage staff access.'
                : 'Only sessions currently assigned to you are shown.',
            )}
          </p>
        </div>
        {admin && (
          <button
            className="c-button primary"
            onClick={() => setAction({ kind: 'create' })}
          >
            <PlusIcon />
            {t('Create session')}
          </button>
        )}
      </div>
      <section className="c-panel">
        <div className="c-toolbar">
          <form
            className="c-search"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(search.trim());
              reset();
            }}
          >
            <MagnifyingGlassIcon />
            <input
              aria-label={t('Search sessions')}
              placeholder={t('Session or plan name')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button>{t('Search')}</button>
          </form>
          <div className="c-filters">
            <Select
              aria-label={t('Session state')}
              value={open}
              onValueChange={(value) => {
                setOpen(value);
                reset();
              }}
            >
              <option value="">{t('All sessions')}</option>
              <option value="true">{t('Open')}</option>
              <option value="false">{t('Closed')}</option>
            </Select>
            <button
              className="c-icon-button bordered"
              aria-label={t('Refresh')}
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              {loading ? <Spinner /> : <ReloadIcon />}
            </button>
          </div>
        </div>
        <div className="c-session-dates">
          <label>
            {t('From date')}
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                reset();
              }}
            />
          </label>
          <label>
            {t('To date')}
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                reset();
              }}
            />
          </label>
          {(from || to) && (
            <button
              className="c-button secondary small"
              onClick={() => {
                setFrom('');
                setTo('');
                reset();
              }}
            >
              {t('Clear dates')}
            </button>
          )}
        </div>
        {error ? (
          <div className="c-content-pad">
            <Alert>{error}</Alert>
            <button
              className="c-button secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t('Retry')}
            </button>
          </div>
        ) : loading ? (
          <Skeleton kind="cards" />
        ) : !data?.items.length ? (
          <div className="c-empty">
            <CalendarIcon />
            <h2>{t('No sessions found')}</h2>
            <p>
              {t(
                admin
                  ? 'Create a session or adjust the filters.'
                  : 'Ask your administrator to assign you to a session.',
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="c-plan-grid">
              {data.items.map((item) => (
                <article className="c-plan-card" key={item.id}>
                  <div className="c-plan-top">
                    <span className="c-feature-icon">
                      <CalendarIcon />
                    </span>
                    <span
                      className={`c-membership-status ${item.open ? 'is-active' : 'is-expired'}`}
                    >
                      {t(item.open ? 'Open' : 'Closed')}
                    </span>
                  </div>
                  <h2>{item.name}</h2>
                  <p>{item.plan.name}</p>
                  <time className="c-session-date">{item.meetupDate}</time>
                  {admin && (
                    <div className="c-session-roster">
                      <strong>{t('Assigned staff')}</strong>
                      <p>
                        {item.staff?.length
                          ? item.staff
                              .map(
                                (staff) =>
                                  `${staff.name}${!staff.enabled || staff.role !== 'staff' ? ` (${t('No current staff access')})` : ''}`,
                              )
                              .join(', ')
                          : t('No staff assigned')}
                      </p>
                    </div>
                  )}
                  {admin && (
                    <div className="c-plan-actions">
                      <button
                        className="c-button secondary small"
                        onClick={() => setAction({ kind: 'staff', item })}
                      >
                        <PersonIcon />
                        {t('Manage staff')}
                      </button>
                      <button
                        className="c-button secondary small"
                        onClick={() => setAction({ kind: 'state', item })}
                      >
                        {t(item.open ? 'Close session' : 'Open session')}
                      </button>
                      <button
                        className="c-icon-button bordered"
                        aria-label={`${t('Change history')} · ${item.name}`}
                        onClick={() => setAction({ kind: 'audit', item })}
                      >
                        <ClockIcon />
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <Pager
              page={page}
              count={data.items.length}
              next={!!data.nextCursor}
              onPrevious={() => setPage((value) => value - 1)}
              onNext={() => {
                setCursors((values) => [
                  ...values.slice(0, page + 1),
                  data.nextCursor!,
                ]);
                setPage((value) => value + 1);
              }}
            />
          </>
        )}
      </section>
      <p className="c-footnote">
        {t(
          'Meetup dates use Myanmar time. Live check-ins require an open session on its meetup date.',
        )}
      </p>
      {action?.kind === 'audit' ? (
        <AuditDialog
          kind="sessions"
          id={action.item.id}
          onClose={() => setAction(undefined)}
          onAuthError={onAuthError}
        />
      ) : (
        action && (
          <SessionDialog
            action={action}
            onClose={() => setAction(undefined)}
            onAuthError={onAuthError}
            onDone={(message) => {
              setAction(undefined);
              setRevision((value) => value + 1);
              onNotice(message);
            }}
          />
        )
      )}
    </>
  );
}
function StaffPicker({
  ids,
  onChange,
  onAuthError,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  onAuthError: CatalogProps['onAuthError'];
}) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Account[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void consoleApi
        .accounts(
          { role: 'staff', enabled: true, search, limit: 20 },
          controller.signal,
        )
        .then((data) => {
          setItems(data.items);
          setCursor(data.nextCursor);
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setError(messageOf(error));
            onAuthError(error);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, onAuthError, retry]);
  async function more() {
    setLoading(true);
    try {
      const data = await consoleApi.accounts({
        role: 'staff',
        enabled: true,
        search,
        limit: 20,
        cursor: cursor || undefined,
      });
      setItems((values) => [...values, ...data.items]);
      setCursor(data.nextCursor);
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <fieldset className="c-staff-picker">
      <legend>
        {t('Assigned staff')} ({ids.length})
      </legend>
      <label>
        {t('Find staff')}
        <input
          type="search"
          placeholder={t('Name or phone number')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {error && (
        <>
          <Alert>{error}</Alert>
          <button
            className="c-button secondary small"
            type="button"
            disabled={loading}
            onClick={() => setRetry((value) => value + 1)}
          >
            {t('Retry')}
          </button>
        </>
      )}
      <div className="c-staff-options">
        {items.map((staff) => (
          <label className="c-check-option" key={staff.id}>
            <input
              type="checkbox"
              checked={ids.includes(staff.id)}
              disabled={loading}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...ids, staff.id]
                    : ids.filter((id) => id !== staff.id),
                )
              }
            />
            <span>
              {staff.name}
              <small>{staff.phone}</small>
            </span>
          </label>
        ))}
      </div>
      {loading ? (
        <InlineLoading label="Loading staff…" />
      ) : !items.length ? (
        <p>{t('No enabled staff found')}</p>
      ) : null}
      {cursor && (
        <button
          className="c-button secondary small"
          type="button"
          disabled={loading}
          onClick={() => void more()}
        >
          <BusyLabel busy={loading} active="Loading staff…">
            {t('Load more staff')}
          </BusyLabel>
        </button>
      )}
      <small>
        {t(
          'Selections are retained while searching. Use Clear staff to remove all assignments.',
        )}
      </small>
      <button
        type="button"
        className="c-button secondary small"
        onClick={() => onChange([])}
      >
        {t('Clear staff')}
      </button>
    </fieldset>
  );
}
function SessionDialog({
  action,
  onClose,
  onDone,
  onAuthError,
}: {
  action: Action;
  onClose: () => void;
  onDone: (message: string) => void;
  onAuthError: CatalogProps['onAuthError'];
}) {
  const t = useText();
  const item = 'item' in action ? action.item : undefined;
  const [ids, setIds] = useState(item?.staff?.map((staff) => staff.id) || []);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(action.kind === 'create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [optionsRetry, setOptionsRetry] = useState(0);
  useEffect(() => {
    if (action.kind !== 'create') return;
    const controller = new AbortController();
    setLoading(true);
    setOptionsError('');
    const timer = setTimeout(() => {
      void catalogApi
        .plans({ archived: 'false', search, limit: 100 }, controller.signal)
        .then((data) => setPlans(data.items))
        .catch((error) => {
          if (!controller.signal.aborted) {
            setOptionsError(messageOf(error));
            onAuthError(error);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, action.kind, onAuthError, optionsRetry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const reason = String(data.get('reason') || '').trim();
      if (action.kind === 'create') {
        await sessionsApi.create({
          name: String(data.get('name') || '').trim(),
          planId,
          meetupDate: String(data.get('date') || ''),
          open: data.get('state') === 'open',
          staffIds: ids,
          reason,
        });
        onDone('Session created.');
      } else if (action.kind === 'staff') {
        await sessionsApi.staff(action.item, ids, reason);
        onDone('Staff assignments updated.');
      } else if (action.kind === 'state') {
        await sessionsApi.state(action.item, reason);
        onDone(action.item.open ? 'Session closed.' : 'Session opened.');
      }
      onClose();
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setBusy(false);
    }
  }
  const title =
    action.kind === 'create'
      ? 'Create session'
      : action.kind === 'staff'
        ? 'Manage staff'
        : item?.open
          ? 'Close session'
          : 'Open session';
  return (
    <Dialog title={t(title)} onClose={onClose} busy={busy}>
      <p className="c-subtitle">
        {item
          ? `${item.name} · ${item.plan.name} · ${item.meetupDate}`
          : t('Choose a plan and enter the meetup date explicitly.')}
      </p>
      <form className="c-form" onSubmit={submit}>
        {action.kind === 'create' && (
          <>
            <label>
              {t('Session name')}
              <input name="name" required maxLength={120} autoFocus />
            </label>
            <label>
              {t('Find a plan')}
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPlanId('');
                }}
              />
            </label>
            <label>
              {t('Plan')}
              <Select
                aria-label={t('Plan')}
                required
                disabled={loading}
                value={planId}
                onValueChange={(value) => setPlanId(value)}
              >
                <option value="">
                  {t(loading ? 'Loading plans…' : 'Select an available plan')}
                </option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
              <small>
                {t('Search if your plan is not in the first 100 results.')}
              </small>
            </label>
            {optionsError && (
              <>
                <Alert>{optionsError}</Alert>
                <button
                  className="c-button secondary small"
                  type="button"
                  disabled={loading}
                  onClick={() => setOptionsRetry((value) => value + 1)}
                >
                  {t('Retry')}
                </button>
              </>
            )}
            <label>
              {t('Meetup date')}
              <input
                name="date"
                type="date"
                required
                min="1900-01-01"
                max="9999-12-31"
              />
            </label>
            <label>
              {t('Session state')}
              <Select
                name="state"
                aria-label={t('Session state')}
                defaultValue="closed"
              >
                <option value="closed">{t('Closed')}</option>
                <option value="open">{t('Open')}</option>
              </Select>
            </label>
          </>
        )}
        {(action.kind === 'create' || action.kind === 'staff') && (
          <StaffPicker ids={ids} onChange={setIds} onAuthError={onAuthError} />
        )}{' '}
        {action.kind === 'state' && (
          <div className="c-domain-note">
            {t(
              item!.open
                ? 'Closing prevents new check-ins. Existing records are retained.'
                : 'Opening does not record attendance. Live scanning is restricted to the meetup date.',
            )}
          </div>
        )}
        <label>
          {t('Reason')}
          <textarea name="reason" required maxLength={500} rows={2} />
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="c-dialog-actions">
          <button
            className="c-button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            className="c-button primary"
            type="submit"
            disabled={
              busy || (action.kind === 'create' && (!planId || loading))
            }
            aria-busy={busy}
          >
            <BusyLabel busy={busy}>
              {t(action.kind === 'staff' ? 'Save staff' : title)}
            </BusyLabel>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
