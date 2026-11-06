import { Select } from './Select';
import { Spinner } from './Shared';
import { BusyLabel } from './Shared';
import { useEffect, useState, type FormEvent } from 'react';
import {
  PlusIcon,
  ReaderIcon,
  Pencil1Icon,
  ArchiveIcon,
  ClockIcon,
  ReloadIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { catalogApi, type Plan, type Page } from './catalog';
import { Alert, Dialog, Skeleton } from './Shared';
import { Pager, AuditDialog, type CatalogProps } from './CatalogShared';
import { messageOf } from './client';
import { useText } from './i18n';
type Action =
  { kind: 'create' } | { kind: 'edit' | 'availability' | 'audit'; plan: Plan };
export function Plans({ onAuthError, onNotice }: CatalogProps) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [archived, setArchived] = useState('');
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [data, setData] = useState<Page<Plan>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action>();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void catalogApi
      .plans(
        { search: applied, archived, cursor: cursors[page] },
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
  }, [applied, archived, page, cursors, revision, onAuthError]);
  function reset() {
    setPage(0);
    setCursors([undefined]);
  }
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Plans')}</h1>
          <p>
            {t(
              'Reusable visit allowances. Set dates when assigning a membership.',
            )}
          </p>
        </div>
        <button
          className="c-button primary"
          onClick={() => setAction({ kind: 'create' })}
        >
          <PlusIcon />
          {t('Create plan')}
        </button>
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
              aria-label={t('Search plans')}
              placeholder={t('Search plans')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button>{t('Search')}</button>
          </form>
          <div className="c-filters">
            <Select
              aria-label={t('Plan availability')}
              value={archived}
              onValueChange={(value) => {
                setArchived(value);
                reset();
              }}
            >
              <option value="">{t('All plans')}</option>
              <option value="false">{t('Available')}</option>
              <option value="true">{t('Archived')}</option>
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
          <Skeleton kind="cards" />
        ) : !data?.items.length ? (
          <div className="c-empty">
            <ReaderIcon />
            <h2>{t('No plans found')}</h2>
            <p>{t('Create a plan with a visit quota to get started.')}</p>
            <button
              className="c-button secondary"
              onClick={() => setAction({ kind: 'create' })}
            >
              {t('Create plan')}
            </button>
          </div>
        ) : (
          <>
            <div className="c-plan-grid">
              {data.items.map((plan) => (
                <article className="c-plan-card" key={plan.id}>
                  <div className="c-plan-top">
                    <span className="c-feature-icon">
                      <ReaderIcon />
                    </span>
                    <span
                      className={`c-role ${plan.archived ? '' : 'c-role-admin'}`}
                    >
                      {t(plan.archived ? 'Archived' : 'Available')}
                    </span>
                  </div>
                  <h2>{plan.name}</h2>
                  <p className="c-plan-description">
                    {plan.description || '—'}
                  </p>
                  <div className="c-plan-quota">
                    <strong>{plan.totalVisits}</strong>
                    <span>{t('visits per membership')}</span>
                  </div>
                  {plan.benefits && (
                    <p className="c-plan-benefits">{plan.benefits}</p>
                  )}
                  <small>
                    {plan._count?.memberships ?? 0} {t('assigned memberships')}
                  </small>
                  <div className="c-plan-actions">
                    <button
                      className="c-button secondary small"
                      onClick={() => setAction({ kind: 'edit', plan })}
                    >
                      <Pencil1Icon />
                      {t('Edit')}
                    </button>
                    <button
                      className="c-icon-button bordered"
                      aria-label={`Change history for ${plan.name}`}
                      onClick={() => setAction({ kind: 'audit', plan })}
                    >
                      <ClockIcon />
                    </button>
                    <button
                      className="c-button secondary small"
                      onClick={() => setAction({ kind: 'availability', plan })}
                    >
                      <ArchiveIcon />
                      {t(plan.archived ? 'Restore' : 'Archive')}
                    </button>
                  </div>
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
          'Editing a plan never changes the dates or quota of existing memberships.',
        )}
      </p>
      {action?.kind === 'audit' ? (
        <AuditDialog
          kind="plans"
          id={action.plan.id}
          onClose={() => setAction(undefined)}
          onAuthError={onAuthError}
        />
      ) : (
        action && (
          <PlanDialog
            key={action.kind + ('plan' in action ? action.plan.id : '')}
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
function PlanDialog({
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
  const plan = 'plan' in action ? action.plan : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title =
    action.kind === 'availability'
      ? plan!.archived
        ? 'Restore plan'
        : 'Archive plan'
      : action.kind === 'edit'
        ? 'Edit plan'
        : 'Create plan';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const reason = String(form.get('reason') || '').trim();
      if (action.kind === 'availability') {
        await catalogApi.availability(action.plan, reason);
        onDone(
          action.plan.archived
            ? 'Plan restored. New memberships can be assigned.'
            : 'Plan archived. Existing memberships are unchanged.',
        );
      } else {
        const body = {
          name: String(form.get('name') || '').trim(),
          description: String(form.get('description') || '').trim(),
          benefits: String(form.get('benefits') || '').trim(),
          totalVisits: Number(form.get('visits')),
          reason,
        };
        if (action.kind === 'edit')
          await catalogApi.editPlan(action.plan.id, {
            ...body,
            version: action.plan.version,
          });
        else await catalogApi.createPlan(body);
        onDone(
          action.kind === 'edit'
            ? 'Plan updated. Existing memberships kept their original quota.'
            : 'Plan created. You can now assign memberships.',
        );
      }
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t(title)} onClose={onClose} busy={busy}>
      <p className="c-subtitle">
        {action.kind === 'availability'
          ? t(
              'Archiving stops new assignments and renewals. Existing memberships and history are retained.',
            )
          : t(
              'Plan templates contain visits only. Membership dates are entered separately.',
            )}
      </p>
      <form className="c-form" onSubmit={submit}>
        {action.kind !== 'availability' && (
          <>
            <label>
              {t('Plan name')}
              <input
                name="name"
                required
                autoFocus
                maxLength={120}
                defaultValue={plan?.name}
              />
            </label>
            <label>
              {t('Description')}
              <textarea
                name="description"
                maxLength={2000}
                rows={2}
                defaultValue={plan?.description}
              />
            </label>
            <label>
              {t('Benefits')}
              <textarea
                name="benefits"
                maxLength={4000}
                rows={3}
                defaultValue={plan?.benefits}
              />
            </label>
            <label>
              {t('Total visits')}
              <input
                name="visits"
                type="number"
                min={1}
                max={2147483647}
                step={1}
                required
                defaultValue={plan?.totalVisits}
              />
            </label>
          </>
        )}
        <label>
          {t('Reason')}
          <textarea name="reason" required maxLength={500} rows={2} />
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="c-dialog-actions">
          <button
            type="button"
            className="c-button secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            className="c-button primary"
            disabled={busy}
            aria-busy={busy}
          >
            <BusyLabel busy={busy}>
              {t(
                action.kind === 'availability'
                  ? plan!.archived
                    ? 'Restore plan'
                    : 'Archive plan'
                  : 'Save plan',
              )}
            </BusyLabel>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
