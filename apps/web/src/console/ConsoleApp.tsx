import { memberSection } from './member-routes';
import { Attendance } from './Attendance';
import { Scanner } from './Scanner';
import { Signup } from './Signup';
import { Sessions } from './Sessions';
import { Plans } from './Plans';
import { Memberships } from './Memberships';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  DashboardIcon,
  PersonIcon,
  ReaderIcon,
  IdCardIcon,
  CalendarIcon,
  Crosshair2Icon,
  CheckCircledIcon,
  BarChartIcon,
  FileTextIcon,
  GearIcon,
  ExitIcon,
  HamburgerMenuIcon,
  Cross2Icon,
  PlusIcon,
  ArrowRightIcon,
  LockClosedIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  consoleApi,
  ApiError,
  messageOf,
  type Identity,
  type Summary,
  type Directory,
} from './client';
import {
  Alert,
  Brand,
  PasswordInput,
  RoleBadge,
  Skeleton,
  SessionLoading,
  BusyLabel,
  Spinner,
  initials,
} from './Shared';
import { LanguageContext, useText, type Language } from './i18n';
import { Accounts } from './Accounts';
import { PasswordSettings } from './PasswordSettings';
import { getMyProfile, type MemberProfile } from '../api';
import './console.css';
type Icon = typeof DashboardIcon;
const MemberApp = lazy(() =>
  import('./MemberApp').then((module) => ({ default: module.MemberApp })),
);
const pages: { key: string; label: string; icon: Icon; pending?: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: DashboardIcon },
  { key: 'users', label: 'Users & staff', icon: PersonIcon },
  { key: 'plans', label: 'Plans', icon: ReaderIcon },
  { key: 'memberships', label: 'Memberships', icon: IdCardIcon },
  {
    key: 'sessions',
    label: 'Meetup sessions',
    icon: CalendarIcon,
  },
  { key: 'scanner', label: 'QR scanner', icon: Crosshair2Icon },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: CheckCircledIcon,
  },
  {
    key: 'reports',
    label: 'Reports & export',
    icon: BarChartIcon,
    pending: true,
  },
  { key: 'audit-logs', label: 'Audit log', icon: FileTextIcon, pending: true },
  { key: 'settings', label: 'Settings', icon: GearIcon },
];
const aliases: Record<string, string> = {
  '/register': '/signup',
  '/console/accounts': '/console/users',
  '/console/audit': '/console/audit-logs',
  '/console/overview': '/console',
};
function pagePath(key: string) {
  return key === 'overview' ? '/console' : `/console/${key}`;
}
function canonicalPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return aliases[path] || path;
}
function readPage() {
  const path = canonicalPath();
  if (memberSection(path)) return 'member';
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  return pages.find((item) => pagePath(item.key) === path)?.key || 'not-found';
}
function allowedPages(role: string) {
  return pages.filter(
    (item) =>
      role === 'admin' ||
      ['overview', 'settings', 'sessions', 'scanner'].includes(item.key),
  );
}
function memberAppUrl() {
  try {
    const url = new URL(import.meta.env.VITE_MEMBER_APP_URL || '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function initialLanguage(): Language {
  try {
    return localStorage.getItem('moe-console-language') === 'my' ? 'my' : 'en';
  } catch {
    return 'en';
  }
}
export function ConsoleApp() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('moe-console-language', language);
    } catch {
      /* Language preference is optional. */
    }
  }, [language]);
  return (
    <LanguageContext value={language}>
      <Console language={language} setLanguage={setLanguage} />
    </LanguageContext>
  );
}
function Console({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  const t = useText();
  const [user, setUser] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(readPage);
  const [address, setAddress] = useState(
    () => window.location.pathname + window.location.search,
  );
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<{ text: string; success: boolean }>();
  useEffect(() => {
    if (!notice?.success) return;
    const timer = window.setTimeout(() => setNotice(undefined), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [revision, setRevision] = useState(0);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const handler = () => {
      setPage(readPage());
      setAddress(window.location.pathname + window.location.search);
      setMenu(false);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setRestoreError('');
    void consoleApi
      .session(controller.signal)
      .then((data) => setUser(data.user))
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && [401, 403].includes(error.status))
        )
          setRestoreError(messageOf(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const authError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        setUser(null);
        setNotice({
          text: 'Your session has expired. Please sign in again.',
          success: false,
        });
      } else if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
        setUser((value) =>
          value ? { ...value, mustChangePassword: true } : value,
        );
      } else if (error.status === 403) {
        setNotice({ text: error.message, success: false });
      }
    }
  }, []);
  useEffect(() => {
    if (checking || restoreError) return;
    const path = canonicalPath();
    const consoleRole = user?.role === 'admin' || user?.role === 'staff';
    const legacy = path === '/console/qr';
    const known =
      !!memberSection(path) ||
      ['/login', '/signup'].includes(path) ||
      pages.some((item) => pagePath(item.key) === path);
    let target: string | undefined;
    if (user?.role === 'member') {
      if (memberSection(path)) target = undefined;
      else if (
        ['/', '/login', '/signup'].includes(path) ||
        path.startsWith('/console')
      ) {
        const requested = new URLSearchParams(window.location.search).get(
          'returnTo',
        );
        target = requested && memberSection(requested) ? requested : '/member';
      }
    } else if (path === '/' || legacy)
      target = consoleRole ? '/console' : '/login';
    else if (!known) return;
    else if (!user && !['/login', '/signup'].includes(path))
      target = '/login?returnTo=' + encodeURIComponent(path);
    else if (consoleRole && ['/login', '/signup'].includes(path)) {
      const requested = new URLSearchParams(window.location.search).get(
        'returnTo',
      );
      target = allowedPages(user.role).some(
        (item) => pagePath(item.key) === requested,
      )
        ? requested!
        : '/console';
    } else if (
      consoleRole &&
      !allowedPages(user.role).some((item) => pagePath(item.key) === path)
    )
      target = '/console';
    else if (path !== window.location.pathname)
      target = path + (path === '/login' ? window.location.search : '');
    if (target && target !== address) {
      window.history.replaceState(null, '', target);
      setAddress(target);
      setPage(readPage());
      setMenu(false);
    }
  }, [address, user, checking, restoreError]);
  const changed = useCallback(() => setRevision((value) => value + 1), []);
  const signedOut = useCallback((text: string) => {
    setUser(null);
    window.history.replaceState(null, '', '/login');
    setAddress('/login');
    setPage('login');
    setNotice({ text, success: true });
    setMenu(false);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = sidebar.current!;
    const nodes = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)'),
      );
    nodes()[0]?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
      if (event.key === 'Tab') {
        const list = nodes();
        const first = list[0],
          last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, [menu]);
  function navigate(next: string) {
    setPage(next);
    setMenu(false);
    window.history.pushState(
      null,
      '',
      next === 'overview' ? '/console' : `/console/${next}`,
    );
    setAddress(window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
  }
  async function logout() {
    setLogoutBusy(true);
    try {
      await consoleApi.logout();
      signedOut('You have signed out.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        signedOut('You have signed out.');
      else setNotice({ text: messageOf(error), success: false });
    } finally {
      setLogoutBusy(false);
    }
  }
  const languageSwitch = (
    <div className="c-language" aria-label={t('Language')}>
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
  );
  if (checking) return <SessionLoading />;
  if (restoreError)
    return (
      <div className="console-ui c-auth-screen">
        <div className="c-auth-card">
          <Brand />
          <Alert>{restoreError}</Alert>
          <button
            className="c-button primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('Retry')}
          </button>
        </div>
      </div>
    );
  if (
    page === 'not-found' &&
    !['/', '/member', '/signup', '/register', '/console/qr'].includes(
      canonicalPath(),
    )
  )
    return (
      <div className="console-ui c-auth-screen">
        <section className="c-auth-card">
          <Brand />
          <p className="c-eyebrow">404</p>
          <h1>{t('Page not found')}</h1>
          <p>{t('The page you requested does not exist.')}</p>
          <a
            className="c-button primary"
            href={user && user.role !== 'member' ? '/console' : '/login'}
          >
            {t('Continue')}
          </a>
        </section>
      </div>
    );
  if (!user)
    return (
      <div className="console-ui c-auth-screen">
        <div className="c-auth-language">{languageSwitch}</div>
        {page === 'signup' ? (
          <Signup
            onSignedUp={(value) => {
              setNotice({
                text: 'Your member account has been created. Use the member app to view your QR and membership.',
                success: true,
              });
              setUser(value);
            }}
          />
        ) : (
          <SignIn
            notice={notice}
            onSignedIn={(value) => {
              setNotice(undefined);
              setUser(value);
            }}
          />
        )}
      </div>
    );
  if (user.role === 'member')
    return (
      <Suspense fallback={<SessionLoading />}>
        <MemberApp
          user={user}
          languageSwitch={languageSwitch}
          onAuthError={authError}
          onSignOut={() => void logout()}
        />
      </Suspense>
    );
  const isAdmin = user.role === 'admin';
  const allowed = allowedPages(user.role);
  const current = allowed.find((item) => item.key === page) || allowed[0]!;
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
        ref={sidebar}
        className={`c-sidebar ${menu ? 'is-open' : ''}`}
        role={menu ? 'dialog' : undefined}
        aria-modal={menu || undefined}
        aria-label={t('Admin console')}
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
        <p className="c-nav-label">
          {t(
            isAdmin
              ? 'Admin console'
              : user.role === 'staff'
                ? 'Staff console'
                : 'Member account',
          )}
        </p>
        <nav aria-label="Workspace">
          {allowed.map((item) => (
            <button
              key={item.key}
              className={current.key === item.key ? 'is-active' : ''}
              aria-current={current.key === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <item.icon />
              <span>{t(item.label)}</span>
              {item.pending && <span className="c-nav-soon">{t('Soon')}</span>}
            </button>
          ))}
        </nav>
        <div className="c-sidebar-user">
          <span className="c-avatar orange">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.phone}</span>
          </div>
          <button
            className="c-icon-button"
            title={t('Sign out')}
            aria-label={t('Sign out')}
            disabled={logoutBusy}
            aria-busy={logoutBusy}
            onClick={() => void logout()}
          >
            {logoutBusy ? <Spinner /> : <ExitIcon />}
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
              <span>
                {t(
                  pages.find((item) => item.key === page)?.label || 'Overview',
                )}
              </span>
              <strong>{user.name}</strong>
            </div>
          </div>
          <div className="c-topbar-tools">
            <span className="c-workspace-tag">{t('Shared workspace')}</span>
            {languageSwitch}
            <button
              className="c-top-avatar"
              aria-label={t('Account settings')}
              onClick={() => navigate('settings')}
            >
              {initials(user.name)}
            </button>
          </div>
        </header>
        <main id="main-content" className="c-main">
          {notice && (
            <div className="c-notice c-toast" role="status" aria-live="polite">
              <Alert success={notice.success}>{t(notice.text)}</Alert>
              <button
                className="c-icon-button"
                aria-label={t('Close')}
                onClick={() => setNotice(undefined)}
              >
                <Cross2Icon />
              </button>
            </div>
          )}
          {user.mustChangePassword ? (
            <div className="c-forced">
              <p className="c-eyebrow">{t('Account security')}</p>
              <PasswordSettings
                user={user}
                forced
                onChanged={() =>
                  signedOut(
                    'Password updated. Sign in again with your new password.',
                  )
                }
              />
            </div>
          ) : current.key === 'users' ? (
            <Accounts
              user={user}
              onAuthError={authError}
              onChanged={changed}
              onNotice={(text) => setNotice({ text, success: true })}
              onSignedOut={signedOut}
            />
          ) : current.key === 'plans' ? (
            <Plans
              onAuthError={authError}
              onNotice={(text) => setNotice({ text, success: true })}
            />
          ) : current.key === 'memberships' ? (
            <Memberships
              onAuthError={authError}
              onNotice={(text) => setNotice({ text, success: true })}
            />
          ) : current.key === 'sessions' ? (
            <Sessions
              admin={isAdmin}
              onAuthError={authError}
              onNotice={(text) => setNotice({ text, success: true })}
            />
          ) : current.key === 'attendance' ? (
            <Attendance onAuthError={authError} />
          ) : current.key === 'scanner' ? (
            <Scanner onAuthError={authError} />
          ) : current.key === 'settings' ? (
            <>
              <div className="c-page-heading">
                <div>
                  <p className="c-eyebrow">{t('Account security')}</p>
                  <h1>{t('Account settings')}</h1>
                  <p>{t('Manage your password and workspace language.')}</p>
                </div>
              </div>
              <div className="c-settings-grid">
                <PasswordSettings
                  user={user}
                  onChanged={() =>
                    signedOut(
                      'Password updated. Sign in again with your new password.',
                    )
                  }
                />
                <section className="c-panel c-account-info">
                  <h2>{t('Account information')}</h2>
                  <dl>
                    <dt>{t('Name')}</dt>
                    <dd>{user.name}</dd>
                    <dt>{t('Phone number')}</dt>
                    <dd>{user.phone}</dd>
                    <dt>{t('Role')}</dt>
                    <dd>
                      <RoleBadge role={user.role} />
                    </dd>
                    <dt>{t('Language')}</dt>
                    <dd>{languageSwitch}</dd>
                  </dl>
                </section>
              </div>
            </>
          ) : current.pending ? (
            <Pending title={current.label} navigate={navigate} />
          ) : isAdmin ? (
            <Overview
              revision={revision}
              navigate={navigate}
              onAuthError={authError}
            />
          ) : (
            <SelfOverview user={user} />
          )}
          <footer className="c-footer">
            <span>MOE Membership</span>
            <span>
              {new Intl.DateTimeFormat(language === 'my' ? 'my-MM' : 'en-GB', {
                dateStyle: 'medium',
                timeZone: 'Asia/Yangon',
              }).format(new Date())}{' '}
              · Asia/Yangon
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function SignIn({
  notice,
  onSignedIn,
}: {
  notice?: { text: string; success: boolean };
  onSignedIn: (user: Identity) => void;
}) {
  const t = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const result = await consoleApi.login(
        String(form.get('phone') || '').trim(),
        String(form.get('password') || ''),
      );
      onSignedIn(result.user);
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 401
          ? t('Phone number or password is incorrect.')
          : messageOf(error),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="c-auth-card">
      <Brand />
      <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
      <h1>{t('Sign in')}</h1>
      <p className="c-subtitle">
        {t('Sign in with your phone number and password.')}
      </p>
      {notice && <Alert success={notice.success}>{t(notice.text)}</Alert>}
      <form className="c-form" onSubmit={submit}>
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
        {error && <Alert>{error}</Alert>}
        <button
          className="c-button primary"
          disabled={busy}
          aria-busy={busy}
          type="submit"
        >
          <BusyLabel busy={busy} active="Signing in…">
            {t('Sign in')}
          </BusyLabel>
          {!busy && <ArrowRightIcon />}
        </button>
      </form>
      <p className="c-auth-note">
        <LockClosedIcon />
        {t('Members, administrators and staff can sign in here.')}
      </p>
      <p className="c-auth-note">
        {t('New to MOE? Create a member account to get started.')}
      </p>
      <a className="c-member-link" href="/signup">
        {t('Create member account')} <ArrowRightIcon />
      </a>
      {memberAppUrl() && (
        <a className="c-member-link" href={memberAppUrl()}>
          {t('Open member app')} <ArrowRightIcon />
        </a>
      )}
    </section>
  );
}
function Overview({
  revision,
  navigate,
  onAuthError,
}: {
  revision: number;
  navigate: (page: string) => void;
  onAuthError: (error: unknown) => void;
}) {
  const t = useText();
  const [data, setData] = useState<{
    summary: Summary;
    directory: Directory;
  }>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void Promise.all([
      consoleApi.summary(controller.signal),
      consoleApi.accounts({ limit: 5 }, controller.signal),
    ])
      .then(([summary, directory]) => setData({ summary, directory }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(messageOf(error));
          onAuthError(error);
        }
      });
    return () => controller.abort();
  }, [revision, retry, onAuthError]);
  const stats: [string, keyof Summary, Icon][] = [
    ['Total accounts', 'total', PersonIcon],
    ['Enabled accounts', 'enabled', CheckCircledIcon],
    ['Staff accounts', 'staff', IdCardIcon],
    ['Password changes required', 'passwordChangesRequired', LockClosedIcon],
  ];
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('Overview')}</h1>
          <p>{t('A clear view of your community, with live account data.')}</p>
        </div>
        <button className="c-button primary" onClick={() => navigate('users')}>
          <PersonIcon />
          {t('Manage accounts')}
        </button>
      </div>
      {error ? (
        <>
          <Alert>{error}</Alert>
          <button
            className="c-button secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            <ReloadIcon />
            {t('Retry')}
          </button>
        </>
      ) : !data ? (
        <Skeleton kind="stats" />
      ) : (
        <>
          <section className="c-stats" aria-label={t('Live account data')}>
            {stats.map(([label, key, Icon]) => (
              <article className="c-stat" key={key}>
                <div>
                  <span>{t(label)}</span>
                  <Icon />
                </div>
                <strong>{data.summary[key].toLocaleString()}</strong>
                <small>
                  {t(
                    key === 'total'
                      ? 'Across the MOE community'
                      : key === 'enabled'
                        ? 'Currently have account access'
                        : key === 'staff'
                          ? 'Including disabled staff accounts'
                          : 'Must update their temporary password',
                  )}
                </small>
              </article>
            ))}
          </section>
          <div className="c-overview-grid">
            <section className="c-panel">
              <div className="c-section-heading">
                <div>
                  <h2>{t('Account directory')}</h2>
                  <p>{t('Members, staff and administrators')}</p>
                </div>
                <button
                  className="c-text-button"
                  onClick={() => navigate('users')}
                >
                  {t('View all accounts')}
                  <ArrowRightIcon />
                </button>
              </div>
              <div className="c-table-scroll">
                <table className="c-table compact">
                  <thead>
                    <tr>
                      <th>{t('Name')}</th>
                      <th>{t('Role')}</th>
                      <th>{t('Access')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.directory.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="c-person">
                            <span className="c-avatar">
                              {initials(user.name)}
                            </span>
                            <div>
                              <strong>{user.name}</strong>
                              <span>{user.phone}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <RoleBadge role={user.role} />
                        </td>
                        <td>
                          <span
                            className={`c-status ${user.enabled ? '' : 'disabled'}`}
                          >
                            <i />
                            {t(user.enabled ? 'Enabled' : 'Disabled')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="c-panel c-quick-actions">
              <div className="c-section-heading">
                <div>
                  <h2>{t('Quick actions')}</h2>
                  <p>{t('Keep your workspace up to date')}</p>
                </div>
              </div>
              <button onClick={() => navigate('users')}>
                <span className="c-feature-icon">
                  <PlusIcon />
                </span>
                <span>
                  <strong>{t('Manage accounts')}</strong>
                  <small>{t('Create accounts and manage access')}</small>
                </span>
                <ArrowRightIcon />
              </button>
              <button onClick={() => navigate('settings')}>
                <span className="c-feature-icon neutral">
                  <LockClosedIcon />
                </span>
                <span>
                  <strong>{t('Secure your account')}</strong>
                  <small>{t('Update your password')}</small>
                </span>
                <ArrowRightIcon />
              </button>
              <div className="c-next-feature">
                <p className="c-eyebrow">{t('Coming next')}</p>
                <h3>{t('Meetup check-in')}</h3>
                <p>
                  {t(
                    'Choose an assigned session in the QR scanner to record attendance.',
                  )}
                </p>
              </div>
            </section>
          </div>
          <section className="c-roadmap">
            <div>
              <ReaderIcon />
              <div>
                <strong>{t('Plans & memberships')}</strong>
                <span>{t('Set dates and quotas per member')}</span>
              </div>
            </div>
            <div>
              <CalendarIcon />
              <div>
                <strong>{t('Meetup sessions')}</strong>
                <span>{t('Assign staff and organise check-ins')}</span>
              </div>
            </div>
            <div>
              <BarChartIcon />
              <div>
                <strong>{t('Attendance reports')}</strong>
                <span>{t('Track visits and export records')}</span>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
function Pending({
  title,
  navigate,
}: {
  title: string;
  navigate: (page: string) => void;
}) {
  const t = useText();
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t(title)}</h1>
        </div>
      </div>
      <section className="c-panel c-pending">
        <span className="c-feature-icon">
          <ReaderIcon />
        </span>
        <span className="c-pill">{t('Coming next')}</span>
        <h2>{t('This workspace is being prepared.')}</h2>
        <p>
          {t(
            'This feature is not available yet. Account management and password settings are ready to use.',
          )}
        </p>
        <button
          className="c-button secondary"
          onClick={() => navigate('overview')}
        >
          {t('Back to overview')}
          <ArrowRightIcon />
        </button>
      </section>
    </>
  );
}
function SelfOverview({ user }: { user: Identity }) {
  const t = useText();
  const [profile, setProfile] = useState<MemberProfile>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getMyProfile(controller.signal)
      .then(setProfile)
      .catch((error) => {
        if (!controller.signal.aborted) setError(messageOf(error));
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>
            {t('Welcome back')}, {user.name}
          </h1>
          <p>{t('Your account is connected to the MOE community.')}</p>
        </div>
      </div>
      <section className="c-panel c-account-info">
        <h2>{t('Profile')}</h2>
        {error ? (
          <>
            <Alert>{error}</Alert>
            <button
              className="c-button secondary"
              onClick={() => {
                setError('');
                setRetry((value) => value + 1);
              }}
            >
              {t('Retry')}
            </button>
          </>
        ) : profile ? (
          <dl>
            <dt>{t('Member number')}</dt>
            <dd>{profile.memberNumber}</dd>
            <dt>{t('Name')}</dt>
            <dd>{profile.name}</dd>
            <dt>{t('Phone number')}</dt>
            <dd>{profile.phone}</dd>
            <dt>{t('Role')}</dt>
            <dd>
              <RoleBadge role={user.role} />
            </dd>
          </dl>
        ) : (
          <Skeleton kind="profile" />
        )}
        <p className="c-muted">
          {t(
            user.role === 'staff'
              ? 'Open Meetup sessions in the navigation to view your assignments. QR scanning will be added next.'
              : 'Open Personal QR in the navigation to view your QR. Your membership screens will be added later.',
          )}
        </p>
      </section>
    </>
  );
}
