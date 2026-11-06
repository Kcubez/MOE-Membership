import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { Dialog, Alert, Skeleton } from './Shared';
import { catalogApi, type Audit } from './catalog';
import { messageOf } from './client';
import { useText } from './i18n';
export type CatalogProps = {
  onAuthError: (error: unknown) => void;
  onNotice: (message: string) => void;
};
export function Pager({
  page,
  count,
  next,
  onPrevious,
  onNext,
}: {
  page: number;
  count: number;
  next: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useText();
  return (
    <div className="c-pagination">
      <span>
        {t('Records on this page')}: <strong>{count}</strong>
      </span>
      <div>
        <button
          className="c-button secondary small"
          disabled={!page}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
          {t('Previous')}
        </button>
        <span>
          {t('Page')} {page + 1}
        </span>
        <button
          className="c-button secondary small"
          disabled={!next}
          onClick={onNext}
        >
          {t('Next')}
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
export function AuditDialog({
  kind,
  id,
  onClose,
  onAuthError,
}: {
  kind: 'plans' | 'memberships' | 'sessions';
  id: string;
  onClose: () => void;
  onAuthError: CatalogProps['onAuthError'];
}) {
  const t = useText();
  const [items, setItems] = useState<Audit[]>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setItems(undefined);
    void catalogApi
      .audit(kind, id, controller.signal)
      .then((data) => setItems(data.items))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(messageOf(error));
          onAuthError(error);
        }
      });
    return () => controller.abort();
  }, [kind, id, onAuthError, revision]);
  const labels: Record<string, string> = {
    name: 'Name',
    meetupDate: 'Meetup date',
    open: 'Open',
    staffNames: 'Assigned staff',
    description: 'Description',
    benefits: 'Benefits',
    totalVisits: 'Total visits',
    usedVisits: 'Used visits',
    startDate: 'Start date',
    endDate: 'End date',
    archived: 'Archived',
    cancellationReason: 'Cancellation reason',
    cancelledAt: 'Cancelled at',
  };
  return (
    <Dialog title={t('Change history')} onClose={onClose}>
      <p className="c-subtitle">
        {t('Latest 100 recorded changes. Times shown in Myanmar time.')}
      </p>
      {error ? (
        <>
          <Alert>{error}</Alert>
          <button
            className="c-button secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            {t('Retry')}
          </button>
        </>
      ) : !items ? (
        <Skeleton kind="history" />
      ) : (
        <div className="c-audit-list">
          {items.length === 0 ? (
            <p>{t('No changes recorded.')}</p>
          ) : (
            items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {t(
                      item.action.replace(/^[^.]+\./, '').replaceAll('_', ' '),
                    )}
                  </strong>
                  <time>
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Yangon',
                    }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <p>
                  {item.actorName} · {item.reason}
                </p>
                <details>
                  <summary>{t('View changes')}</summary>
                  <dl>
                    {Object.entries(labels)
                      .filter(
                        ([key]) =>
                          item.after &&
                          key in item.after &&
                          JSON.stringify(item.before?.[key]) !==
                            JSON.stringify(item.after[key]),
                      )
                      .map(([key, label]) => (
                        <div key={key}>
                          <dt>{t(label)}</dt>
                          <dd>
                            {item.before && key in item.before && (
                              <del>{String(item.before[key] ?? '—')}</del>
                            )}
                            <span>{String(item.after?.[key] ?? '—')}</span>
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              </article>
            ))
          )}
        </div>
      )}
    </Dialog>
  );
}
