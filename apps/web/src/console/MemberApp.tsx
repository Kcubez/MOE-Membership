import {
  memberRoutes,
  memberSection,
  type MemberSection,
} from './member-routes';
import {
  DashboardIcon,
  IdCardIcon,
  ReaderIcon,
  CheckCircledIcon,
  GearIcon,
  HamburgerMenuIcon,
  Cross2Icon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from '@zxing/library';
import { call, messageOf, type Identity } from './client';
import type { Membership, Page } from './catalog';
import type { AttendanceRecord } from './attendance-api';
import type { MemberProfile } from '../api';
import { Alert, Brand, Skeleton } from './Shared';
import { PasswordSettings } from './PasswordSettings';
import { useText } from './i18n';
type QR = {
  payload: string;
  name: string;
  memberNumber: string;
  version: number;
};
type Section = MemberSection;
function Code({ payload }: { payload: string }) {
  const hints = new Map();
  hints.set(EncodeHintType.MARGIN, 4);
  hints.set(EncodeHintType.ERROR_CORRECTION, 'M');
  const matrix = new QRCodeWriter().encode(
    payload,
    BarcodeFormat.QR_CODE,
    256,
    256,
    hints,
  );
  let path = '';
  for (let y = 0; y < matrix.getHeight(); y++)
    for (let x = 0; x < matrix.getWidth(); x++)
      if (matrix.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
  return (
    <svg
      role="img"
      aria-label="Personal QR code"
      viewBox={`0 0 ${matrix.getWidth()} ${matrix.getHeight()}`}
      className="member-qr"
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
export function MemberApp({
  user,
  onSignOut,
  onAuthError,
  languageSwitch,
}: {
  user: Identity;
  onSignOut: () => void;
  onAuthError: (error: unknown) => void;
  languageSwitch: ReactNode;
}) {
  const t = useText();
  const [menu, setMenu] = useState(false);
  const [section, setSection] = useState<Section>(
      () => memberSection(window.location.pathname) || 'overview',
    ),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [profile, setProfile] = useState<MemberProfile>(),
    [qr, setQr] = useState<QR>(),
    [memberships, setMemberships] = useState<Membership[]>([]),
    [history, setHistory] = useState<AttendanceRecord[]>([]),
    [membershipCursor, setMembershipCursor] = useState<string | null>(null),
    [historyCursor, setHistoryCursor] = useState<string | null>(null);
  useEffect(() => {
    if (user.mustChangePassword) return;
    const c = new AbortController();
    setBusy(true);
    setError('');
    Promise.all([
      call<MemberProfile>('/members/me', { signal: c.signal }),
      call<Page<Membership>>('/members/me/memberships?limit=20', {
        signal: c.signal,
      }),
      call<Page<AttendanceRecord>>('/members/me/attendance?limit=20', {
        signal: c.signal,
      }),
    ])
      .then(([p, m, h]) => {
        setProfile(p);
        setMemberships(m.items);
        setMembershipCursor(m.nextCursor);
        setHistory(h.items);
        setHistoryCursor(h.nextCursor);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(messageOf(e));
          onAuthError(e);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [revision, user.mustChangePassword, onAuthError]);
  useEffect(() => {
    if (section !== 'qr' || user.mustChangePassword) {
      setQr(undefined);
      return;
    }
    const c = new AbortController();
    setQr(undefined);
    call<QR>('/members/me/qr', { signal: c.signal })
      .then(setQr)
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(messageOf(e));
          onAuthError(e);
        }
      });
    return () => c.abort();
  }, [section, revision, user.mustChangePassword, onAuthError]);
  async function more(kind: 'memberships' | 'history') {
    const cursor = kind === 'memberships' ? membershipCursor : historyCursor;
    if (!cursor) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'memberships') {
        const p = await call<Page<Membership>>(
          `/members/me/memberships?limit=20&cursor=${encodeURIComponent(cursor)}`,
        );
        setMemberships((v) => [...v, ...p.items]);
        setMembershipCursor(p.nextCursor);
      } else {
        const p = await call<Page<AttendanceRecord>>(
          `/members/me/attendance?limit=20&cursor=${encodeURIComponent(cursor)}`,
        );
        setHistory((v) => [...v, ...p.items]);
        setHistoryCursor(p.nextCursor);
      }
    } catch (e) {
      setError(messageOf(e));
      onAuthError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const sync = () => {
      const next = memberSection(window.location.pathname);
      if (next) setSection(next);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  function navigate(next: Section) {
    if (window.location.pathname !== memberRoutes[next]) {
      window.history.pushState(null, '', memberRoutes[next]);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setSection(next);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }
  const tabs: [Section, string][] = [
    ['overview', 'Overview'],
    ['qr', 'Personal QR'],
    ['memberships', 'Memberships'],
    ['history', 'Attendance history'],
    ['settings', 'Settings'],
  ];
  return (
    <div className="console-ui c-app">
      {menu && (
        <button
          className="c-scrim"
          aria-label={t('Close navigation')}
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`c-sidebar ${menu ? 'is-open' : ''}`}
        aria-label={t('Member account')}
      >
        <div className="c-sidebar-brand">
          <Brand />
          <button
            className="c-icon-button c-mobile-only"
            aria-label={t('Close navigation')}
            onClick={() => setMenu(false)}
          >
            <Cross2Icon />
          </button>
        </div>
        <p className="c-nav-label">{t('Member account')}</p>
        <nav aria-label={t('Member account')}>
          {tabs.map(([id, label], index) => {
            const Icon = [
              DashboardIcon,
              IdCardIcon,
              ReaderIcon,
              CheckCircledIcon,
              GearIcon,
            ][index]!;
            return (
              <button
                key={id}
                className={section === id ? 'is-active' : ''}
                onClick={() => {
                  navigate(id);
                  setMenu(false);
                }}
                aria-current={section === id ? 'page' : undefined}
              >
                <Icon />
                <span>{t(label)}</span>
              </button>
            );
          })}
        </nav>
        <div className="c-sidebar-user">
          <span className="c-avatar orange">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.phone}</span>
          </div>
          <button
            className="c-icon-button"
            aria-label={t('Sign out')}
            onClick={onSignOut}
          >
            <ExitIcon />
          </button>
        </div>
      </aside>
      <div className="c-workspace">
        <header className="c-topbar">
          <div className="c-topbar-person">
            <button
              className="c-icon-button c-mobile-only"
              aria-label={t('Open navigation')}
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <HamburgerMenuIcon />
            </button>
            <div>
              <span>{t('Member account')}</span>
              <strong>{user.name}</strong>
            </div>
          </div>
          <div className="c-topbar-tools">
            {languageSwitch}
            <button
              className="c-top-avatar"
              aria-label={t('Account settings')}
              onClick={() => navigate('settings')}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="c-main">
          <div className="c-page-heading">
            <div>
              <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
              <h1>{t(tabs.find(([id]) => id === section)![1])}</h1>
            </div>
            <button
              className="c-button secondary"
              disabled={busy}
              onClick={() => setRevision((v) => v + 1)}
            >
              {t('Refresh')}
            </button>
          </div>
          {user.mustChangePassword ? (
            <PasswordSettings user={user} forced onChanged={onSignOut} />
          ) : (
            <>
              {error && <Alert>{t(error)}</Alert>}
              {error && (
                <button
                  className="c-button secondary"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  {t('Retry')}
                </button>
              )}
              {busy && !profile ? (
                <Skeleton />
              ) : (
                <>
                  {section === 'overview' && (
                    <section className="c-panel member-card">
                      <h2>
                        {t('Welcome back')}, {profile?.name || user.name}
                      </h2>
                      <p>{profile?.memberNumber}</p>
                      <p>
                        {t(
                          'Your memberships, visits and attendance in one place.',
                        )}
                      </p>
                      <button
                        className="c-button primary"
                        onClick={() => navigate('qr')}
                      >
                        {t('Personal QR')}
                      </button>
                    </section>
                  )}
                  {section === 'qr' && (
                    <section className="c-panel member-card member-qr-card">
                      {qr ? (
                        <>
                          <Code payload={qr.payload} />
                          <h2>{qr.name}</h2>
                          <strong>{qr.memberNumber}</strong>
                          <p>{t('Show this QR to staff at your meetup.')}</p>
                        </>
                      ) : (
                        <p>{t('QR temporarily unavailable')}</p>
                      )}
                      <button
                        className="c-button secondary"
                        disabled={busy}
                        onClick={() => setRevision((v) => v + 1)}
                      >
                        {t('Refresh QR')}
                      </button>
                    </section>
                  )}
                  {section === 'memberships' && (
                    <section className="c-panel member-card">
                      {memberships.length === 0 ? (
                        <p>
                          {t('No membership assigned yet. Please contact MOE.')}
                        </p>
                      ) : (
                        memberships.map((m) => (
                          <article className="member-row" key={m.id}>
                            <h2>{m.plan.name}</h2>
                            <p>
                              {t(m.status)} · {m.startDate} — {m.endDate}
                            </p>
                            <p>
                              {t('Remaining visits')}:{' '}
                              <strong>
                                {m.remainingVisits} / {m.totalVisits}
                              </strong>
                            </p>
                          </article>
                        ))
                      )}
                      {membershipCursor && (
                        <button
                          className="c-button secondary"
                          disabled={busy}
                          onClick={() => void more('memberships')}
                        >
                          {t('Load more')}
                        </button>
                      )}
                    </section>
                  )}
                  {section === 'history' && (
                    <section className="c-panel member-card">
                      {history.length === 0 ? (
                        <p>{t('No attendance records yet.')}</p>
                      ) : (
                        history.map((a) => (
                          <article className="member-row" key={a.id}>
                            <h2>{a.session.name}</h2>
                            <p>
                              {a.plan.name} ·{' '}
                              {new Intl.DateTimeFormat(undefined, {
                                timeZone: 'Asia/Yangon',
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(a.occurredAt))}
                            </p>
                            <p>
                              {t(
                                a.status === 'cancelled'
                                  ? 'Cancelled'
                                  : 'Effective',
                              )}{' '}
                              · {t(a.method === 'scan' ? 'Scan' : 'Backfill')}
                            </p>
                            {a.cancellation && (
                              <p>
                                {t('Cancellation reason')}:{' '}
                                {a.cancellation.reason}
                              </p>
                            )}
                          </article>
                        ))
                      )}
                      {historyCursor && (
                        <button
                          className="c-button secondary"
                          disabled={busy}
                          onClick={() => void more('history')}
                        >
                          {t('Load more')}
                        </button>
                      )}
                    </section>
                  )}
                  {section === 'settings' && (
                    <PasswordSettings user={user} onChanged={onSignOut} />
                  )}
                </>
              )}
            </>
          )}
          <footer className="c-footer">
            <span>MOE Membership</span>
            <span>Asia/Yangon</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
