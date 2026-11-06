import { Select } from './Select';
import { Spinner } from './Shared';
import { BusyLabel } from './Shared';
import { RegenerateQrDialog } from './QrManagement';
import { useEffect, useState, type FormEvent } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ReloadIcon,
  IdCardIcon,
  Pencil1Icon,
  LockClosedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import {
  consoleApi,
  messageOf,
  type Account,
  type Directory,
  type Identity,
} from './client';
import {
  Alert,
  Dialog,
  PasswordInput,
  RoleBadge,
  Skeleton,
  initials,
} from './Shared';
import { useText } from './i18n';
type Action =
  | { kind: 'create' }
  | { kind: 'access' | 'reset'; account: Account }
  | { kind: 'qr'; account: Account };
type Props = {
  user: Identity;
  onAuthError: (error: unknown) => void;
  onNotice: (text: string) => void;
  onChanged: () => void;
  onSignedOut: (text: string) => void;
};
export function Accounts(props: Props) {
  const t = useText();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [role, setRole] = useState('');
  const [access, setAccess] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Directory>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState<Action>();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void consoleApi
      .accounts(
        {
          search: applied,
          cursor: cursors[page],
          role: role || undefined,
          enabled: access ? access === 'enabled' : undefined,
        },
        controller.signal,
      )
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(messageOf(error));
          props.onAuthError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applied, role, access, page, cursors, refresh, props.onAuthError]);
  function resetPage() {
    setPage(0);
    setCursors([undefined]);
  }
  function changed(message: string) {
    setAction(undefined);
    props.onNotice(message);
    setRefresh((value) => value + 1);
    props.onChanged();
  }
  function searchSubmit(event: FormEvent) {
    event.preventDefault();
    resetPage();
    setApplied(search.trim());
  }
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Users & staff')}</h1>
          <p>{t('Manage accounts, roles and access in one place.')}</p>
        </div>
        <button
          className="c-button primary"
          onClick={() => setAction({ kind: 'create' })}
        >
          <PlusIcon />
          {t('Create account')}
        </button>
      </div>
      <section className="c-panel c-directory">
        <div className="c-toolbar">
          <form className="c-search" onSubmit={searchSubmit}>
            <MagnifyingGlassIcon />
            <input
              aria-label={t('Search by name or phone')}
              placeholder={t('Search by name or phone')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" aria-busy={loading}>
              {t('Search')}
            </button>
          </form>
          <div className="c-filters">
            <Select
              aria-label={t('Role')}
              value={role}
              onValueChange={(value) => {
                setRole(value);
                resetPage();
              }}
            >
              <option value="">{t('All roles')}</option>
              {['member', 'staff', 'admin'].map((value) => (
                <option key={value} value={value}>
                  {t(value[0]!.toUpperCase() + value.slice(1))}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('Access')}
              value={access}
              onValueChange={(value) => {
                setAccess(value);
                resetPage();
              }}
            >
              <option value="">{t('All statuses')}</option>
              <option value="enabled">{t('Enabled')}</option>
              <option value="disabled">{t('Disabled')}</option>
            </Select>
            <button
              className="c-icon-button bordered"
              aria-label={t('Refresh')}
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
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
              onClick={() => setRefresh((value) => value + 1)}
            >
              {t('Retry')}
            </button>
          </div>
        ) : loading ? (
          <Skeleton kind="table" />
        ) : data?.items.length ? (
          <>
            <div className="c-table-scroll">
              <table className="c-table">
                <thead>
                  <tr>
                    {[
                      'Name',
                      'Role',
                      'Access',
                      'Password setup',
                      'Actions',
                    ].map((label) => (
                      <th key={label} scope="col">
                        {t(label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="c-person">
                          <span className="c-avatar" aria-hidden="true">
                            {initials(account.name)}
                          </span>
                          <div>
                            <strong>
                              {account.name}
                              {account.id === props.user.id && (
                                <small className="c-you">{t('You')}</small>
                              )}
                            </strong>
                            <span>{account.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={account.role} />
                      </td>
                      <td>
                        <span
                          className={`c-status ${account.enabled ? '' : 'disabled'}`}
                        >
                          <i />
                          {t(account.enabled ? 'Enabled' : 'Disabled')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            account.mustChangePassword
                              ? 'c-setup-required'
                              : 'c-muted'
                          }
                        >
                          {t(
                            account.mustChangePassword
                              ? 'Change required'
                              : 'Ready',
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="c-row-actions">
                          <button
                            className="c-icon-button bordered"
                            title={t('Regenerate QR')}
                            aria-label={`Regenerate QR for ${account.name}`}
                            onClick={() => setAction({ kind: 'qr', account })}
                          >
                            <IdCardIcon />
                          </button>
                          <button
                            className="c-icon-button bordered"
                            disabled={account.role === 'admin'}
                            title={
                              account.role === 'admin'
                                ? 'Admin access is protected'
                                : t('Edit access')
                            }
                            aria-label={`Edit access for ${account.name}`}
                            onClick={() =>
                              setAction({ kind: 'access', account })
                            }
                          >
                            <Pencil1Icon />
                          </button>
                          <button
                            className="c-icon-button bordered"
                            title={t('Reset password')}
                            aria-label={`Reset password for ${account.name}`}
                            onClick={() =>
                              setAction({ kind: 'reset', account })
                            }
                          >
                            <LockClosedIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="c-pagination">
              <span>
                {t('Accounts on this page')}:{' '}
                <strong>{data.items.length}</strong>
              </span>
              <div>
                <button
                  className="c-button secondary small"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeftIcon />
                  {t('Previous')}
                </button>
                <span>
                  {t('Page')} {page + 1}
                </span>
                <button
                  className="c-button secondary small"
                  disabled={!data.nextCursor}
                  onClick={() => {
                    setCursors((values) => [
                      ...values.slice(0, page + 1),
                      data.nextCursor!,
                    ]);
                    setPage((value) => value + 1);
                  }}
                >
                  {t('Next')}
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="c-empty">
            <MagnifyingGlassIcon />
            <h2>{t('No matching accounts')}</h2>
            <p>{t('Try a different name or phone number.')}</p>
            <button
              className="c-button secondary"
              onClick={() => {
                setSearch('');
                setApplied('');
                setRole('');
                setAccess('');
                resetPage();
              }}
            >
              {t('Clear')}
            </button>
          </div>
        )}
      </section>
      <p className="c-footnote">
        {t(
          'Changes to access or passwords revoke existing sessions. Every change requires a reason.',
        )}
      </p>
      {action?.kind === 'qr' ? (
        <RegenerateQrDialog
          account={action.account}
          onClose={() => setAction(undefined)}
          onDone={changed}
          onAuthError={props.onAuthError}
        />
      ) : (
        action && (
          <AccountDialog
            key={action.kind + ('account' in action ? action.account.id : '')}
            action={action}
            user={props.user}
            onClose={() => setAction(undefined)}
            onDone={changed}
            onAuthError={props.onAuthError}
            onSignedOut={props.onSignedOut}
          />
        )
      )}
    </>
  );
}
function AccountDialog({
  action,
  user,
  onClose,
  onDone,
  onAuthError,
  onSignedOut,
}: {
  action: Exclude<Action, { kind: 'qr' }>;
  user: Identity;
  onClose: () => void;
  onDone: (message: string) => void;
  onAuthError: Props['onAuthError'];
  onSignedOut: Props['onSignedOut'];
}) {
  const t = useText();
  const target = 'account' in action ? action.account : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<'member' | 'staff'>(
    target?.role === 'staff' ? 'staff' : 'member',
  );
  const [enabled, setEnabled] = useState(target?.enabled ?? true);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const reason = String(form.get('reason') || '').trim();
      if (action.kind === 'create') {
        const result = await consoleApi.create({
          name: String(form.get('name') || '').trim(),
          phone: String(form.get('phone') || '').trim(),
          temporaryPassword: String(form.get('password') || ''),
          role,
        });
        onDone(
          result.created
            ? 'Account created. Share the temporary password privately with the account owner.'
            : 'This phone already has an account. Existing details were kept unchanged.',
        );
      } else if (action.kind === 'reset') {
        if (form.get('verified') !== 'on')
          throw new Error(
            'Complete Page identity verification before resetting a password.',
          );
        await consoleApi.reset(
          action.account.id,
          String(form.get('password') || ''),
          reason,
        );
        if (action.account.id === user.id)
          onSignedOut(
            'Password reset. Sign in with the new temporary password.',
          );
        else onDone('Password reset. Previous sessions were revoked.');
      } else {
        await consoleApi.access(action.account.id, enabled, role, reason);
        onDone('Account access updated. Previous sessions were revoked.');
      }
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setBusy(false);
    }
  }
  const title = t(
    action.kind === 'create'
      ? 'Create account'
      : action.kind === 'reset'
        ? 'Reset password'
        : 'Edit access',
  );
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <p className="c-subtitle">
        {target
          ? `${target.name} · ${target.phone}`
          : t(
              'Create a member or staff account. An existing phone keeps its current account.',
            )}
      </p>
      <form className="c-form" onSubmit={submit}>
        {action.kind === 'create' && (
          <>
            <label>
              {t('Full name')}
              <input
                name="name"
                required
                autoFocus
                maxLength={120}
                autoComplete="off"
              />
            </label>
            <label>
              {t('Phone number')}
              <input
                name="phone"
                type="tel"
                required
                maxLength={40}
                placeholder="09… / +959…"
                autoComplete="off"
              />
            </label>
          </>
        )}
        {action.kind !== 'reset' && (
          <label>
            {t('Role')}
            <Select
              aria-label={t('Role')}
              value={role}
              onValueChange={(value) => setRole(value as 'member' | 'staff')}
            >
              <option value="member">{t('Member')}</option>
              <option value="staff">{t('Staff')}</option>
            </Select>
          </label>
        )}
        {action.kind === 'access' ? (
          <label>
            {t('Access')}
            <Select
              aria-label={t('Access')}
              value={enabled ? 'enabled' : 'disabled'}
              onValueChange={(value) => setEnabled(value === 'enabled')}
            >
              <option value="enabled">{t('Enabled')}</option>
              <option value="disabled">{t('Disabled')}</option>
            </Select>
          </label>
        ) : (
          <label>
            {t('Temporary password')}
            <PasswordInput
              name="password"
              aria-label={t('Temporary password')}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>
              {t(
                'The account owner must change this password at first sign-in.',
              )}
            </small>
          </label>
        )}
        {action.kind !== 'create' && (
          <label>
            {t('Reason')}
            <textarea
              name="reason"
              required
              minLength={1}
              maxLength={500}
              rows={3}
              placeholder={t('Why are you making this change?')}
            />
          </label>
        )}
        {action.kind === 'reset' && (
          <label className="c-checkbox">
            <input type="checkbox" name="verified" required />
            <span>{t('Page identity verification completed')}</span>
          </label>
        )}
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
            className="c-button primary"
            disabled={busy}
            aria-busy={busy}
            type="submit"
          >
            <BusyLabel busy={busy}>
              {t(
                action.kind === 'create'
                  ? 'Create account'
                  : action.kind === 'reset'
                    ? 'Reset password'
                    : 'Save changes',
              )}
            </BusyLabel>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
