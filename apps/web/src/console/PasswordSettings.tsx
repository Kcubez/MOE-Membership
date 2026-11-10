import { BusyLabel } from './Shared';
import { useState, type FormEvent } from 'react';
import { LockClosedIcon } from '@radix-ui/react-icons';
import { consoleApi, messageOf, ApiError, type Identity } from './client';
import { Alert, PasswordInput } from './Shared';
import { useText } from './i18n';
export function PasswordSettings({
  user,
  onChanged,
  forced = false,
}: {
  user: Identity;
  onChanged: () => void;
  forced?: boolean;
}) {
  const t = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get('current') || '');
    const next = String(form.get('new') || '');
    if (next !== form.get('confirm')) {
      setError(t('Passwords do not match.'));
      return;
    }
    if (current === next) {
      setError(t('Choose a different new password.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await consoleApi.password(current, next);
      onChanged();
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 401
          ? t('Current password is incorrect, or your session expired.')
          : messageOf(error),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="c-panel c-security">
      <span className="c-feature-icon">
        <LockClosedIcon />
      </span>
      <h2>
        {t(forced ? 'Change your temporary password' : 'Change password')}
      </h2>
      <p>
        {t(
          forced
            ? 'Set a new password before continuing to your workspace.'
            : 'Updating your password signs you out on every device. Sign in again with the new password.',
        )}
      </p>
      <form className="c-form" onSubmit={submit}>
        <input
          type="text"
          autoComplete="username"
          value={(user.role === 'member' ? user.phone : user.email) ?? ''}
          readOnly
          hidden
        />
        <label>
          {t('Current password')}
          <PasswordInput
            name="current"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        <label>
          {t('New password')}
          <PasswordInput
            name="new"
            aria-label={t('New password')}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
          <small>
            {t(
              'Use at least 8 characters and a password you do not use elsewhere.',
            )}
          </small>
        </label>
        <label>
          {t('Confirm new password')}
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        {error && <Alert>{error}</Alert>}
        <button
          className="c-button primary"
          disabled={busy}
          aria-busy={busy}
          type="submit"
        >
          <BusyLabel busy={busy} active="Updating password…">
            {t('Update password')}
          </BusyLabel>
        </button>
      </form>
    </section>
  );
}
