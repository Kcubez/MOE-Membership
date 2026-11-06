import { Select } from './Select';
import { Spinner } from './Shared';
import { BusyLabel } from './Shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
  Pencil1Icon,
  ClockIcon,
  ResetIcon,
  CrossCircledIcon,
  IdCardIcon,
} from '@radix-ui/react-icons';
import { catalogApi, type Membership, type Plan, type Page } from './catalog';
import { consoleApi, messageOf, type Account } from './client';
import { Alert, Dialog, Skeleton } from './Shared';
import { Pager, AuditDialog, type CatalogProps } from './CatalogShared';
import { useText } from './i18n';
type Action =
  | { kind: 'assign' }
  | { kind: 'edit' | 'renew' | 'cancel' | 'audit'; item: Membership };
export function Memberships({ onAuthError, onNotice }: CatalogProps) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<Page<Membership>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [action, setAction] = useState<Action>();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void catalogApi
      .memberships(
        { search: applied, status, cursor: cursors[page] },
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
  }, [applied, status, page, cursors, revision, onAuthError]);
  function reset() {
    setPage(0);
    setCursors([undefined]);
  }
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Memberships')}</h1>
          <p>
            {t(
              'Individual terms, explicit dates and independent visit balances.',
            )}
          </p>
        </div>
        <button
          className="c-button primary"
          onClick={() => setAction({ kind: 'assign' })}
        >
          <PlusIcon />
          {t('Assign membership')}
        </button>
      </div>
      <section className="c-panel c-membership-directory">
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
              aria-label={t('Search memberships')}
              placeholder={t('Search by member, phone or plan')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button>{t('Search')}</button>
          </form>
          <div className="c-filters">
            <Select
              aria-label={t('Membership status')}
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                reset();
              }}
            >
              <option value="">{t('All statuses')}</option>
              {['Active', 'Upcoming', 'Completed', 'Expired', 'Cancelled'].map(
                (value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ),
              )}
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
          <Skeleton kind="table" />
        ) : !data?.items.length ? (
          <div className="c-empty">
            <IdCardIcon />
            <h2>{t('No memberships found')}</h2>
            <p>
              {t(
                'Assign an available plan to an existing account with explicit dates.',
              )}
            </p>
            <button
              className="c-button secondary"
              onClick={() => setAction({ kind: 'assign' })}
            >
              {t('Assign membership')}
            </button>
          </div>
        ) : (
          <>
            <div className="c-table-scroll">
              <table className="c-table">
                <thead>
                  <tr>
                    {[
                      'Member',
                      'Plan',
                      'Period',
                      'Visits',
                      'Status',
                      'Actions',
                    ].map((value) => (
                      <th key={value}>{t(value)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="c-membership-person">
                          <strong>{item.user.name}</strong>
                          <span>{item.user.phone}</span>
                          <small>
                            {item.user.profile
                              ? `MOE-${String(item.user.profile.memberNumber).padStart(6, '0')}`
                              : ''}
                          </small>
                        </div>
                      </td>
                      <td>
                        <strong>{item.plan.name}</strong>
                        {item.renewedFromId && (
                          <small className="c-renewal-label">
                            {t('Renewed term')}
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="c-date-range">
                          <span>{item.startDate}</span>
                          <span>{item.endDate}</span>
                        </div>
                      </td>
                      <td>
                        <div className="c-visit-balance">
                          <strong>
                            {item.remainingVisits}
                            <small> / {item.totalVisits}</small>
                          </strong>
                          <span>
                            {item.usedVisits} {t('used')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`c-membership-status is-${item.status.toLowerCase()}`}
                        >
                          {t(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className="c-row-actions">
                          <button
                            className="c-icon-button bordered"
                            disabled={item.status === 'Cancelled'}
                            aria-label={`Edit membership for ${item.user.name}`}
                            title={t('Edit membership')}
                            onClick={() => setAction({ kind: 'edit', item })}
                          >
                            <Pencil1Icon />
                          </button>
                          <button
                            className="c-icon-button bordered"
                            disabled={item.plan.archived}
                            aria-label={`Renew membership for ${item.user.name}`}
                            title={t('Renew membership')}
                            onClick={() => setAction({ kind: 'renew', item })}
                          >
                            <ResetIcon />
                          </button>
                          <button
                            className="c-icon-button bordered"
                            aria-label={`Change history for ${item.user.name}`}
                            title={t('Change history')}
                            onClick={() => setAction({ kind: 'audit', item })}
                          >
                            <ClockIcon />
                          </button>
                          <button
                            className="c-icon-button bordered"
                            disabled={item.status === 'Cancelled'}
                            aria-label={`Cancel membership for ${item.user.name}`}
                            title={t('Cancel membership')}
                            onClick={() => setAction({ kind: 'cancel', item })}
                          >
                            <CrossCircledIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          'Dates are inclusive in Myanmar time. Cancelled terms can be replaced; unused visits never roll over.',
        )}
      </p>
      {action?.kind === 'audit' ? (
        <AuditDialog
          kind="memberships"
          id={action.item.id}
          onClose={() => setAction(undefined)}
          onAuthError={onAuthError}
        />
      ) : (
        action && (
          <MembershipDialog
            key={action.kind + ('item' in action ? action.item.id : '')}
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
function UserPicker({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (id: string) => void;
  onError: (error: unknown) => void;
}) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      void consoleApi
        .accounts(
          { search, enabled: true, role: 'member', limit: 20 },
          controller.signal,
        )
        .then((data) => {
          setItems(data.items);
          setError('');
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setError(messageOf(error));
            onError(error);
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
  }, [search, onError, retry]);
  return (
    <div className="c-user-picker">
      <label>
        {t('Find an account')}
        <input
          type="search"
          value={search}
          placeholder={t('Name or phone number')}
          onChange={(event) => {
            setSearch(event.target.value);
            onChange('');
          }}
        />
      </label>
      <label>
        {t('Member')}
        <Select
          aria-label={t('Member')}
          required
          value={value}
          disabled={loading}
          onValueChange={(value) => onChange(value)}
        >
          <option value="">
            {t(loading ? 'Loading accounts…' : 'Select an account')}
          </option>
          {items.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {user.phone}
            </option>
          ))}
        </Select>
        <small>
          {t(
            'Showing up to 20 enabled members. Search to find another member.',
          )}
        </small>
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
    </div>
  );
}
function MembershipDialog({
  action,
  onClose,
  onDone,
  onAuthError,
}: {
  action: Exclude<Action, { kind: 'audit' }>;
  onClose: () => void;
  onDone: (message: string) => void;
  onAuthError: CatalogProps['onAuthError'];
}) {
  const t = useText();
  const item = 'item' in action ? action.item : undefined;
  const [userId, setUserId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [loading, setLoading] = useState(action.kind === 'assign');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [optionsRetry, setOptionsRetry] = useState(0);
  const plan =
    action.kind === 'assign'
      ? plans.find((value) => value.id === planId)
      : item?.plan;
  useEffect(() => {
    if (action.kind !== 'assign') return;
    const controller = new AbortController();
    setLoading(true);
    setOptionsError('');
    const timer = setTimeout(() => {
      void catalogApi
        .plans(
          { archived: 'false', search: planSearch, limit: 100 },
          controller.signal,
        )
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
  }, [action.kind, planSearch, onAuthError, optionsRetry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const reason = String(form.get('reason') || '').trim();
      const period = {
        startDate: String(form.get('start') || ''),
        endDate: String(form.get('end') || ''),
        reason,
      };
      if (action.kind !== 'cancel' && period.endDate < period.startDate)
        throw new Error('End date cannot be before start date.');
      if (action.kind === 'assign') {
        if (!plan || !userId)
          throw new Error('Select an account and an available plan.');
        await catalogApi.assign({
          ...period,
          userId,
          planId: plan.id,
          planVersion: plan.version,
        });
        onDone(
          'Membership assigned. Its dates and quota are saved independently.',
        );
      } else if (action.kind === 'edit') {
        await catalogApi.edit(action.item, {
          ...period,
          totalVisits: Number(form.get('visits')),
        });
        onDone(
          'Membership updated. The reason and previous values were recorded.',
        );
      } else if (action.kind === 'renew') {
        await catalogApi.renew(action.item, period);
        onDone(
          'New membership term created. Previous visits were not carried forward.',
        );
      } else {
        await catalogApi.cancel(action.item, reason);
        onDone('Membership cancelled. Its visit history has been retained.');
      }
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setBusy(false);
    }
  }
  const title =
    action.kind === 'assign'
      ? 'Assign membership'
      : action.kind === 'edit'
        ? 'Edit membership'
        : action.kind === 'renew'
          ? 'Renew membership'
          : 'Cancel membership';
  return (
    <Dialog title={t(title)} onClose={onClose} busy={busy}>
      <p className="c-subtitle">
        {item
          ? `${item.user.name} · ${item.plan.name}`
          : t('Choose an account and plan, then enter both dates yourself.')}
      </p>
      <form className="c-form" onSubmit={submit}>
        {action.kind === 'assign' && (
          <>
            <UserPicker
              value={userId}
              onChange={setUserId}
              onError={onAuthError}
            />
            <label>
              {t('Find a plan')}
              <input
                type="search"
                value={planSearch}
                placeholder={t('Plan name')}
                onChange={(event) => {
                  setPlanSearch(event.target.value);
                  setPlanId('');
                }}
              />
            </label>
            <label>
              {t('Plan')}
              <Select
                aria-label={t('Plan')}
                value={planId}
                onValueChange={(value) => setPlanId(value)}
                required
                disabled={loading}
              >
                <option value="">
                  {t(loading ? 'Loading plans…' : 'Select an available plan')}
                </option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.totalVisits} {t('visits')}
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
          </>
        )}
        {action.kind === 'cancel' ? (
          <div className="c-domain-note">
            {t(
              'This term will stop being eligible for check-in. Existing usage and history will be retained. A replacement term may overlap it after cancellation.',
            )}
          </div>
        ) : (
          <>
            {action.kind !== 'edit' && (
              <div className="c-domain-note">
                <strong>
                  {plan
                    ? `${plan.totalVisits} ${t('visits in the new term')}`
                    : t('Select a plan to see its quota.')}
                </strong>
                <p>
                  {t(
                    'No unused visits are carried forward. Both dates must be entered explicitly.',
                  )}
                </p>
              </div>
            )}
            <div className="c-date-fields">
              <label>
                {t('Start date')}
                <input
                  name="start"
                  type="date"
                  required
                  min="1900-01-01"
                  max="9999-12-31"
                  defaultValue={action.kind === 'edit' ? item!.startDate : ''}
                />
              </label>
              <label>
                {t('End date')}
                <input
                  name="end"
                  type="date"
                  required
                  min="1900-01-01"
                  max="9999-12-31"
                  defaultValue={action.kind === 'edit' ? item!.endDate : ''}
                />
              </label>
            </div>
            {action.kind === 'edit' && (
              <label>
                {t('Total visits')}
                <input
                  name="visits"
                  type="number"
                  required
                  step={1}
                  min={Math.max(1, item!.usedVisits)}
                  max={2147483647}
                  defaultValue={item!.totalVisits}
                />
                <small>
                  {item!.usedVisits}{' '}
                  {t('visits already used. Total cannot be lower than this.')}
                </small>
              </label>
            )}
          </>
        )}
        <label>
          {t('Reason')}
          <textarea name="reason" rows={2} required maxLength={500} />
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
              busy ||
              (action.kind === 'assign' && (!plan || !userId || loading))
            }
            aria-busy={busy}
          >
            <BusyLabel busy={busy} active="Saving…">
              {t(title)}
            </BusyLabel>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
