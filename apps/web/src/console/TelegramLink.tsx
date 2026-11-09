import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, call, consoleApi, messageOf } from './client';
import { Alert, Brand, PasswordInput } from './Shared';
import { LanguageContext, useText, type Language } from './i18n';

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData: string; close(): void } };
};

function LinkForm() {
  const t = useText();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!app?.initData || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    let signingIn = true;
    try {
      await consoleApi.login(
        String(data.get('phone') || '').trim(),
        String(data.get('password') || ''),
        'member',
      );
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
          body: { initData: app.initData, action },
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError(
          signingIn
            ? 'Unable to sign in. Check your phone number and password, then try again.'
            : 'Reopen this link from the MOE bot and try again.',
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
      ) : loading ? (
        <p role="status">{t('Loading…')}</p>
      ) : !app?.initData ? (
        <Alert>{t('Open this link from the MOE Telegram bot.')}</Alert>
      ) : (
        <form className="c-form" onSubmit={submit}>
          <p>{t('Sign in once to link this Telegram account.')}</p>
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
          {error && <Alert>{t(error)}</Alert>}
          <button className="c-button primary" disabled={busy} aria-busy={busy}>
            {t(busy ? 'Signing in…' : 'Sign in and link')}
          </button>
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
