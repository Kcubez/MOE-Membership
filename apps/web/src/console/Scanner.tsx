import { Select } from './Select';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  CameraIcon,
  CheckCircledIcon,
  Crosshair2Icon,
} from '@radix-ui/react-icons';
import type { IScannerControls } from '@zxing/browser';
import { sessionsApi, type MeetupSession } from './sessions-api';
import { ApiError, call, messageOf } from './client';
import { Alert, BusyLabel, InlineLoading } from './Shared';
import type { CatalogProps } from './CatalogShared';
import { useText } from './i18n';
type Operation = { sessionId: string; requestId: string; qrPayload: string };
import type { AttendanceResult as Result } from './attendance-api';
export function Scanner({ onAuthError }: Pick<CatalogProps, 'onAuthError'>) {
  const t = useText();
  const [sessions, setSessions] = useState<MeetupSession[]>([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [pending, setPending] = useState<Operation>();
  const [result, setResult] = useState<Result>();
  const [online, setOnline] = useState(navigator.onLine);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | undefined>(undefined);
  const controls = useRef<IScannerControls | undefined>(undefined);
  const epoch = useRef(0);
  const gate = useRef(false);
  const request = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const stopCamera = useCallback(() => {
    epoch.current++;
    controls.current?.stop();
    controls.current = undefined;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    if (video.current) video.current.srcObject = null;
    setCamera(false);
    setStarting(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const off = () => {
      setOnline(false);
      stopCamera();
    };
    const on = () => setOnline(true);
    const hidden = () => {
      if (document.hidden) stopCamera();
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stopCamera);
    return () => {
      mounted.current = false;
      stopCamera();
      request.current?.abort();
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
      window.removeEventListener('pagehide', stopCamera);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [stopCamera]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const timer = setTimeout(() => {
      void sessionsApi
        .list(
          { open: 'true', from: day, to: day, search, limit: 100 },
          controller.signal,
        )
        .then((data) => {
          setSessions(data.items);
          setSelected((value) =>
            data.items.some((item) => item.id === value) ? value : '',
          );
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setLoadError(messageOf(error));
            onAuthError(error);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, revision, onAuthError]);
  const send = useCallback(
    async (operation: Operation) => {
      if (gate.current) return;
      gate.current = true;
      stopCamera();
      setPending(operation);
      setBusy(true);
      setError('');
      setResult(undefined);
      const controller = new AbortController();
      request.current = controller;
      try {
        if (!navigator.onLine)
          throw new ApiError(
            0,
            'NETWORK_ERROR',
            'You are offline. Reconnect, then retry this scan.',
          );
        const data = await call<Result>(
          `/sessions/${encodeURIComponent(operation.sessionId)}/check-ins`,
          {
            method: 'POST',
            body: {
              requestId: operation.requestId,
              qrPayload: operation.qrPayload,
            },
            signal: controller.signal,
          },
        );
        if (mounted.current) {
          setResult(data);
          setPending(undefined);
        }
      } catch (error) {
        if (!controller.signal.aborted && mounted.current) {
          setError(
            error instanceof ApiError && error.status === 404
              ? 'This session is no longer available to you.'
              : messageOf(error),
          );
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
          )
            setPending(undefined);
          onAuthError(error);
        }
      } finally {
        gate.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [onAuthError, stopCamera],
  );
  async function startCamera() {
    if (!selected || pending || gate.current) return;
    stopCamera();
    setError('');
    setResult(undefined);
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before scanning.');
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Camera access requires HTTPS or localhost. You can scan an image instead.',
      );
      return;
    }
    const token = epoch.current;
    setStarting(true);
    try {
      const captured = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (token !== epoch.current || !mounted.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (token !== epoch.current || !mounted.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 200,
      });
      setCamera(true);
      const handle = await reader.decodeFromStream(
        captured,
        video.current!,
        (decoded, _error, handle) => {
          if (decoded && token === epoch.current && !gate.current) {
            handle.stop();
            void send({
              sessionId: selected,
              requestId: crypto.randomUUID(),
              qrPayload: decoded.getText(),
            });
          }
        },
      );
      if (token !== epoch.current || !mounted.current) handle.stop();
      else {
        controls.current = handle;
        setStarting(false);
      }
    } catch (error) {
      if (token === epoch.current && mounted.current) {
        stopCamera();
        const name = error instanceof Error ? error.name : '';
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was denied. Allow access or scan an image.'
            : name === 'NotFoundError'
              ? 'No camera was found. You can scan an image instead.'
              : 'Unable to start the camera. Check permissions or scan an image.',
        );
      }
    }
  }
  async function image(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected || pending || gate.current) return;
    stopCamera();
    setError('');
    setResult(undefined);
    if (
      !['image/png', 'image/jpeg'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('Choose a PNG or JPEG image smaller than 10 MB.');
      return;
    }
    setDecoding(true);
    const token = epoch.current;
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const decoded = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (token === epoch.current && mounted.current)
        await send({
          sessionId: selected,
          requestId: crypto.randomUUID(),
          qrPayload: decoded.getText(),
        });
    } catch {
      if (mounted.current && token === epoch.current)
        setError('No readable QR was found in this image.');
    } finally {
      URL.revokeObjectURL(url);
      if (mounted.current) setDecoding(false);
    }
  }
  return (
    <>
      <div className="c-page-heading">
        <div>
          <p className="c-eyebrow">MOE MEMBERSHIP SYSTEM</p>
          <h1>{t('QR scanner')}</h1>
          <p>
            {t('Select a meetup, then scan a member QR to record attendance.')}
          </p>
        </div>
      </div>
      <div className="c-scanner-grid">
        <section className="c-panel c-scanner-panel">
          <label>
            {t('Find a session')}
            <input
              type="search"
              value={search}
              disabled={busy || !!pending || camera || starting || decoding}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            {t('Session')}
            <Select
              aria-label={t('Session')}
              value={selected}
              disabled={loading || busy || !!pending || starting || decoding}
              onValueChange={(value) => {
                stopCamera();
                setSelected(value);
                setError('');
                setResult(undefined);
              }}
            >
              <option value="">
                {t(loading ? 'Loading sessions…' : 'Select a session')}
              </option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.plan.name} · {item.meetupDate}
                </option>
              ))}
            </Select>
            <small>
              {t(
                'Showing up to 100 open sessions for today in Myanmar time. Search to narrow the list.',
              )}
            </small>
          </label>
          {loadError && <Alert>{loadError}</Alert>}
          {!loading && !sessions.length && !loadError && (
            <p>
              {t(
                'No open sessions for today. Ask Admin to create, open or assign a session.',
              )}
            </p>
          )}
          <button
            className="c-button secondary small"
            disabled={
              loading || busy || !!pending || starting || camera || decoding
            }
            onClick={() => setRevision((value) => value + 1)}
          >
            {t('Refresh sessions')}
          </button>
          <div className="c-camera-preview">
            <video
              ref={video}
              muted
              playsInline
              aria-label={t('Camera preview')}
              className={camera ? 'is-active' : ''}
            />
            {!camera && (
              <div>
                <Crosshair2Icon />
                <p>
                  {t(
                    starting
                      ? 'Waiting for camera permission…'
                      : 'Camera is off',
                  )}
                </p>
              </div>
            )}
          </div>
          {camera || starting ? (
            <button className="c-button secondary" onClick={stopCamera}>
              {t('Stop camera')}
            </button>
          ) : (
            <button
              className="c-button primary"
              disabled={!selected || busy || !!pending || decoding || !online}
              onClick={() => void startCamera()}
            >
              <CameraIcon />
              {t('Start camera')}
            </button>
          )}
          <label className="c-scan-image">
            {t('Or scan a QR image')}
            <input
              aria-label={t('QR image')}
              type="file"
              accept="image/png,image/jpeg"
              disabled={
                !selected ||
                busy ||
                !!pending ||
                starting ||
                camera ||
                decoding ||
                !online
              }
              onChange={(event) => void image(event)}
            />
          </label>
          {decoding && <InlineLoading label="Reading QR…" />}
          <small>
            {t('Images are decoded on this device and are not uploaded.')}
          </small>
        </section>
        <section className="c-panel c-scan-result" aria-live="polite">
          {!online && (
            <Alert>
              {t('You are offline. No new check-in can be confirmed.')}
            </Alert>
          )}
          {busy ? (
            <InlineLoading label="Confirming check-in…" />
          ) : result ? (
            <>
              <CheckCircledIcon
                className={
                  result.outcome === 'CANCELLED'
                    ? 'is-cancelled'
                    : 'is-confirmed'
                }
              />
              <h2>
                {t(
                  result.outcome === 'CHECKED_IN'
                    ? 'Check-in confirmed'
                    : result.outcome === 'ALREADY_CHECKED_IN'
                      ? 'Already checked in'
                      : 'Check-in cancelled',
                )}
              </h2>
              <h3>{result.member.name}</h3>
              <p>{result.member.memberNumber}</p>
              <p>
                {result.plan.name} · {result.session.name}
              </p>
              <p>
                {new Intl.DateTimeFormat('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Yangon',
                }).format(new Date(result.checkedInAt))}
              </p>
              <strong className="c-scan-balance">
                {result.membership.remainingVisits} /{' '}
                {result.membership.totalVisits}
              </strong>
              <p>{t('Visits remaining')}</p>
              {result.outcome === 'ALREADY_CHECKED_IN' && (
                <p>
                  {t('Original check-in shown. No extra visit was charged.')}
                </p>
              )}
              {result.outcome === 'CANCELLED' && (
                <p>
                  {t(
                    'The previous check-in was cancelled. This retry did not create another check-in.',
                  )}
                </p>
              )}
              {result.replayed && (
                <small>
                  {t(
                    'Saved result recovered. This retry did not charge again.',
                  )}
                </small>
              )}
            </>
          ) : (
            !error && (
              <>
                <Crosshair2Icon />
                <h2>{t('Ready to scan')}</h2>
                <p>
                  {t(
                    'A decoded QR becomes a check-in only after the server confirms it.',
                  )}
                </p>
              </>
            )
          )}
          {error && <Alert>{error}</Alert>}
          {pending && (
            <div className="c-domain-note">
              <p>
                {t(
                  'Result not confirmed. Retry this same scan after reconnecting; do not create a new request.',
                )}
              </p>
              <button
                className="c-button primary"
                disabled={busy || !online}
                aria-busy={busy}
                onClick={() => void send(pending)}
              >
                <BusyLabel busy={busy} active="Confirming check-in…">
                  {t('Retry same scan')}
                </BusyLabel>
              </button>
            </div>
          )}
        </section>
      </div>
      <p className="c-footnote">
        {t(
          'Verify the person matches the member name and number. Live scanning is limited to the session meetup date.',
        )}
      </p>
    </>
  );
}
