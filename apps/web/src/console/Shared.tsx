import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from 'react';
import { Cross2Icon, EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons';
import { useText } from './i18n';
export function Brand() {
  return (
    <a className="c-brand" href="/console" aria-label="MOE Membership home">
      <img src="/moe-logo.png" alt="MOE Myanmar" />
      <span>Membership</span>
    </a>
  );
}
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const t = useText();
  return (
    <span className="c-password">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
      </button>
    </span>
  );
}
export function Alert({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  const t = useText();
  return (
    <div
      className={`c-alert ${success ? 'is-success' : ''}`}
      role={success ? 'status' : 'alert'}
    >
      {typeof children === 'string' ? t(children) : children}
    </div>
  );
}
export function Spinner() {
  return <span className="c-spinner" aria-hidden="true" />;
}
export function BusyLabel({
  busy,
  children,
  active = 'Saving…',
}: {
  busy: boolean;
  children: ReactNode;
  active?: string;
}) {
  const t = useText();
  return (
    <span className="c-action-label" aria-live="polite">
      {busy && <Spinner />}
      {busy ? t(active) : children}
    </span>
  );
}
export function InlineLoading({ label = 'Loading…' }: { label?: string }) {
  const t = useText();
  return (
    <span className="c-inline-loading" role="status" aria-live="polite">
      <Spinner />
      {t(label)}
    </span>
  );
}
export function SessionLoading() {
  const t = useText();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="console-ui c-auth-screen">
      <div
        className="c-session-loader"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Brand />
        <Spinner />
        <p>{t('Please wait…')}</p>
        {slow && (
          <small>{t('This is taking a little longer than expected.')}</small>
        )}
      </div>
    </div>
  );
}
export function Skeleton({
  kind = 'details',
}: {
  kind?: 'table' | 'cards' | 'stats' | 'profile' | 'details' | 'history';
}) {
  const t = useText();
  const bar = (key: number) => <span className="c-skeleton-bar" key={key} />;
  return (
    <div
      className={`c-skeleton c-skeleton-${kind}`}
      role="status"
      aria-label={t('Loading…')}
      aria-busy="true"
    >
      <div aria-hidden="true">
        {kind === 'table' ? (
          <>
            <div className="c-skeleton-row is-heading">
              {Array.from({ length: 5 }, (_, i) => bar(i))}
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div className="c-skeleton-row" key={i}>
                {Array.from({ length: 5 }, (_, j) => bar(j))}
              </div>
            ))}
          </>
        ) : kind === 'cards' || kind === 'stats' ? (
          Array.from({ length: kind === 'stats' ? 4 : 2 }, (_, i) => (
            <div className="c-skeleton-tile" key={i}>
              {bar(0)}
              {bar(1)}
              {bar(2)}
            </div>
          ))
        ) : kind === 'profile' ? (
          Array.from({ length: 4 }, (_, i) => (
            <div className="c-skeleton-pair" key={i}>
              {bar(0)}
              {bar(1)}
            </div>
          ))
        ) : kind === 'history' ? (
          Array.from({ length: 3 }, (_, i) => (
            <div className="c-skeleton-history-entry" key={i}>
              {bar(0)}
              {bar(1)}
              {bar(2)}
            </div>
          ))
        ) : (
          <>
            {bar(0)}
            {bar(1)}
            {bar(2)}
          </>
        )}
      </div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const t = useText();
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      className="c-dialog"
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="c-dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="c-icon-button"
          type="button"
          aria-label={t('Close')}
          disabled={busy}
          onClick={onClose}
        >
          <Cross2Icon />
        </button>
      </div>
      <div className="c-dialog-body">{children}</div>
    </dialog>
  );
}
export function RoleBadge({ role }: { role: string }) {
  const t = useText();
  return (
    <span className={`c-role c-role-${role}`}>
      {t(role.charAt(0).toUpperCase() + role.slice(1))}
    </span>
  );
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
