import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, call, consoleApi, messageOf, type Identity } from './client';
import { Alert, Brand, PasswordInput } from './Shared';
import { LanguageContext, useText, type Language } from './i18n';

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData: string; close(): void } };
};

function LinkForm() {
  const t = useText();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Identity>();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState<{ delivered: boolean }>();
  const app = (window as TelegramWindow).Telegram?.WebApp;

  useEffect(() => {
    if ((window as TelegramWindow).Telegram?.WebApp) {
      setLoading(false);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = script.onerror = () => setLoading(false);
    document.head.append(script);
    return () => script.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    consoleApi
      .session(controller.signal)
      .then(({ user }) => setUser(user))
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && error.status === 401)
        )
          setError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function switchAccount() {
    setBusy(true);
    setError('');
    try {
      await consoleApi.logout();
      setUser(undefined);
      setReplaceExisting(false);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!app?.initData || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    let signingIn = !user;
    try {
      if (!user) {
        const result = await consoleApi.login(
          String(data.get('phone') || '').trim(),
          String(data.get('password') || ''),
          'member',
        );
        setUser(result.user);
      }
      signingIn = false;
      form.reset();
      const requested = new URLSearchParams(window.location.search).get(
        'action',
      );
      const action =
        requested && ['qr', 'plan', 'history'].includes(requested)
          ? requested
          : undefined;
      setLinked(
        await call<{ delivered: boolean }>('/telegram/link', {
          method: 'POST',
          body: { initData: app.initData, action, replaceExisting },
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError(
          signingIn
            ? 'Unable to sign in. Check your phone number and password, then try again.'
            : 'Reopen this link from the MOE bot and try again.',
        );
      } else if (
        error instanceof ApiError &&
        error.code === 'MEMBER_TELEGRAM_ALREADY_LINKED'
      ) {
        setReplaceExisting(true);
        setError(
          'Your MOE account is connected to another Telegram account. Replace that connection to use this account. The previous Telegram account will lose access.',
        );
      } else if (
        error instanceof ApiError &&
        error.code === 'TELEGRAM_ALREADY_LINKED'
      ) {
        setError(
          'This Telegram account is linked to another MOE account. Use another MOE account or Logout in this bot chat first.',
        );
      } else {
        setError(messageOf(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="c-auth-card">
      <Brand />
      <h1>{t('Link MOE account')}</h1>
      {linked ? (
        <>
          <Alert success>
            {t(
              linked.delivered
                ? 'Account linked. Check your bot chat.'
                : 'Account linked. Tap a button in the bot chat to continue.',
            )}
          </Alert>
          <button className="c-button primary" onClick={() => app?.close()}>
            {t('Back to bot')}
          </button>
        </>
      ) : loading || sessionLoading ? (
        <p role="status">{t('Loading…')}</p>
      ) : !app?.initData ? (
        <Alert>{t('Open this link from the MOE Telegram bot.')}</Alert>
      ) : (
        <form className="c-form" onSubmit={submit}>
          {user ? (
            <p>
              {t('Link this Telegram account to')} <strong>{user.name}</strong>?
            </p>
          ) : (
            <p>{t('Sign in once to link this Telegram account.')}</p>
          )}
          {!user && (
            <>
              <label>
                {t('Phone number')}
                <input
                  name="phone"
                  type="tel"
                  autoComplete="username"
                  placeholder="09… / +959…"
                  required
                  maxLength={40}
                />
              </label>
              <label>
                {t('Password')}
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            </>
          )}
          {user && user.role !== 'member' && (
            <Alert>{t('Use a member account to link Telegram.')}</Alert>
          )}
          {error && <Alert>{t(error)}</Alert>}
          <button
            className="c-button primary"
            disabled={
              busy ||
              (!!user && (user.role !== 'member' || user.mustChangePassword))
            }
            aria-busy={busy}
          >
            {t(
              busy
                ? 'Loading…'
                : user
                  ? replaceExisting
                    ? 'Replace connection and link'
                    : 'Link account'
                  : 'Sign in and link',
            )}
          </button>
          {user && (
            <button
              type="button"
              className="c-button"
              disabled={busy}
              onClick={switchAccount}
            >
              {t('Use another account')}
            </button>
          )}
          {user?.mustChangePassword && (
            <Alert>{t('Change your temporary password to continue.')}</Alert>
          )}
        </form>
      )}
    </section>
  );
}

export function TelegramLink() {
  const [language, setLanguage] = useState<Language>('en');
  return (
    <LanguageContext.Provider value={language}>
      <main className="console-ui c-auth-screen">
        <div className="c-auth-language">
          <div className="c-language" aria-label="Language">
            <button
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('my')}
              aria-pressed={language === 'my'}
            >
              မြန်မာ
            </button>
          </div>
        </div>
        <LinkForm />
      </main>
    </LanguageContext.Provider>
  );
}
