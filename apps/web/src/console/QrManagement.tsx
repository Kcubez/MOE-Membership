import { BusyLabel } from './Shared';
import { useEffect, useState, type FormEvent } from 'react';
import { call, messageOf, type Account } from './client';
import { Dialog, Alert, Skeleton } from './Shared';
import { useText } from './i18n';
import type { Audit } from './catalog';
import type { CatalogProps } from './CatalogShared';
type Metadata = { userId: string; version: number; updatedAt: string };
export function RegenerateQrDialog({
  account,
  onClose,
  onDone,
  onAuthError,
}: {
  account: Account;
  onClose: () => void;
  onDone: (message: string) => void;
  onAuthError: CatalogProps['onAuthError'];
}) {
  const t = useText();
  const [data, setData] = useState<Metadata>();
  const [history, setHistory] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const path = `/admin/users/${encodeURIComponent(account.id)}/qr`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void Promise.all([
      call<Metadata>(path, { signal: controller.signal }),
      call<{ items: Audit[] }>(path + '/audit', { signal: controller.signal }),
    ])
      .then(([meta, audit]) => {
        setData(meta);
        setHistory(audit.items);
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
    return () => controller.abort();
  }, [path, retry, onAuthError]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const reason = String(
      new FormData(event.currentTarget).get('reason') || '',
    ).trim();
    setBusy(true);
    setError('');
    try {
      await call<Metadata>(path + '/regenerate', {
        method: 'POST',
        body: { version: data.version, reason },
      });
      onDone(
        'QR regenerated. The previous QR is invalid. Ask the account owner to refresh their QR.',
      );
    } catch (error) {
      setError(messageOf(error));
      onAuthError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t('Regenerate QR')} onClose={onClose} busy={busy}>
      <p className="c-subtitle">
        {account.name} · {account.phone}
      </p>
      {loading ? (
        <Skeleton kind="details" />
      ) : !data ? (
        <>
          <Alert>{error}</Alert>
          <button
            className="c-button secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t('Retry')}
          </button>
        </>
      ) : (
        <>
          <p className="c-domain-note">
            {t(
              'The previous QR will stop working. Memberships, visits and login sessions remain unchanged.',
            )}
          </p>
          <p>
            {t('QR version')}: {data.version}
          </p>
          <form className="c-form" onSubmit={submit}>
            <label>
              {t('Reason')}
              <textarea name="reason" required rows={2} maxLength={500} />
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
                disabled={busy}
                aria-busy={busy}
              >
                <BusyLabel busy={busy} active="Replacing QR…">
                  {t('Regenerate QR')}
                </BusyLabel>
              </button>
            </div>
          </form>
          <div className="c-qr-history">
            <h3>{t('Recent QR changes')}</h3>
            {history.length ? (
              history.slice(0, 10).map((item) => (
                <article key={item.id}>
                  <strong>{item.actorName}</strong>
                  <p>{item.reason}</p>
                  <small>
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Yangon',
                    }).format(new Date(item.createdAt))}
                  </small>
                </article>
              ))
            ) : (
              <p>{t('No changes recorded.')}</p>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
