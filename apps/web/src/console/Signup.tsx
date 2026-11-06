import { BusyLabel } from './Shared';
import { useState, type FormEvent } from 'react';
import { ApiError, consoleApi, messageOf, type Identity } from './client';
import { Alert, Brand, PasswordInput } from './Shared';
import { useText } from './i18n';
export function Signup({
  onSignedUp,
}: {
  onSignedUp: (user: Identity) => void;
}) {
  const t = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim(),
      phone = String(form.get('phone') || '').trim(),
      password = String(form.get('password') || '');
    setError('');
    if (!name) {
      setError(t('Enter your full name.'));
      return;
    }
    if (password !== form.get('confirmPassword')) {
      setError(t('Passwords do not match.'));
      return;
    }
    setBusy(true);
    try {
      const result = await consoleApi.signup({ name, phone, password });
      onSignedUp(result.user);
    } catch (error) {
      setError(
        t(
          error instanceof ApiError && error.code === 'SIGNUP_FAILED'
            ? 'Unable to create your account. Check your details. If you already have an account, use the member app or contact MOE.'
            : error instanceof ApiError && error.status === 400
              ? 'Enter your name, a valid Myanmar phone number and a password of 8–128 characters.'
              : messageOf(error),
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="c-auth-card">
      <Brand />
      <p className="c-eyebrow">MOE MEMBERSHIP</p>
      <h1>{t('Create member account')}</h1>
      <p className="c-subtitle">
        {t('Join with your name, Myanmar phone number and password.')}
      </p>
      <form className="c-form" onSubmit={submit}>
        <label>
          {t('Full name')}
          <input
            aria-label={t('Full name')}
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            disabled={busy}
          />
        </label>
        <label>
          {t('Phone number')}
          <input
            aria-label={t('Phone number')}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="09… / +959…"
            required
            maxLength={40}
            disabled={busy}
          />
        </label>
        <label>
          {t('Password')}
          <PasswordInput
            aria-label={t('Password')}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            disabled={busy}
          />
          <small>{t('Use 8–128 characters.')}</small>
        </label>
        <label>
          {t('Confirm password')}
          <PasswordInput
            aria-label={t('Confirm password')}
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            disabled={busy}
          />
        </label>
        {error && <Alert>{error}</Alert>}
        <button
          className="c-button primary"
          disabled={busy}
          aria-busy={busy}
          type="submit"
        >
          <BusyLabel busy={busy} active="Creating account…">
            {t('Create member account')}
          </BusyLabel>
        </button>
      </form>
      <p className="c-auth-note">
        {t(
          'Creating an account does not assign a membership. Admin will assign your plan separately.',
        )}
      </p>
      <a className="c-member-link" href="/login">
        {t('Admin / Staff sign in')}
      </a>
    </section>
  );
}
