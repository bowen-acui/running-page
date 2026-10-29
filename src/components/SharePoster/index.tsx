import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '@/utils/utils';
import { buildRunPoster } from './content';
import styles from './style.module.css';
import {
  drawPoster,
  posterToBlob,
  RATIO_SIZES,
  type PosterContent,
  type PosterRatio,
  type PosterTone,
} from './render';

interface SharePosterProps {
  readonly content: PosterContent;
  readonly runs: readonly Activity[];
  readonly athlete: string;
  readonly periodLabel: string;
  readonly onClose: () => void;
}

const RATIOS: { value: PosterRatio; label: string; hint: string }[] = [
  { value: '3:4', label: '3:4', hint: '小红书' },
  { value: '1:1', label: '1:1', hint: '朋友圈' },
];

const TONES: { value: PosterTone; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const SharePoster = ({
  content,
  runs,
  athlete,
  periodLabel,
  onClose,
}: SharePosterProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [ratio, setRatio] = useState<PosterRatio>('3:4');
  const [tone, setTone] = useState<PosterTone>('light');
  const [scope, setScope] = useState<'period' | 'run'>('period');
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.run_id ?? 0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedRun =
    runs.find((run) => run.run_id === selectedRunId) ?? runs[0];
  const activeContent = useMemo(
    () =>
      scope === 'run' && selectedRun
        ? buildRunPoster(selectedRun, athlete)
        : content,
    [scope, selectedRun, athlete, content]
  );

  // Preview is the same draw call as the export, just scaled — so what you
  // see is exactly what downloads.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const paint = async () => {
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* system fallbacks are fine */
        }
      }
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = RATIO_SIZES[ratio];
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawPoster(ctx, activeContent, ratio, tone);
    };
    void paint();
    return () => {
      cancelled = true;
    };
  }, [activeContent, ratio, tone]);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !overlayRef.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !overlayRef.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl]
  );

  const buildImage = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await posterToBlob(activeContent, ratio, tone);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      return { blob, url };
    } finally {
      setBusy(false);
    }
  }, [activeContent, ratio, tone]);

  const handleSave = useCallback(async () => {
    const made = await buildImage();
    if (!made) return;
    const link = document.createElement('a');
    link.href = made.url;
    const suffix = scope === 'run' ? `-${selectedRun?.run_id}` : '';
    link.download = `running-${activeContent.dateLine.replace(/[^\d]+/g, '')}${suffix}-${ratio.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [buildImage, activeContent.dateLine, ratio, scope, selectedRun]);

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="分享封面"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <header className={styles.sheetHeader}>
          <div>
            <p>Share</p>
            <h2>分享封面</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        <div className={styles.preview}>
          {imageUrl ? (
            // Once generated we swap in an <img>: on phones a long-press on a
            // real image is how people actually save it.
            <img src={imageUrl} alt="跑步分享封面" />
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.scopeControls}>
            <div className={styles.group} role="group" aria-label="封面范围">
              <button
                type="button"
                aria-pressed={scope === 'period'}
                className={scope === 'period' ? styles.active : ''}
                onClick={() => {
                  setScope('period');
                  setImageUrl(null);
                }}
                disabled={busy}
              >
                {periodLabel}
              </button>
              <button
                type="button"
                aria-pressed={scope === 'run'}
                className={scope === 'run' ? styles.active : ''}
                onClick={() => {
                  setScope('run');
                  setImageUrl(null);
                }}
                disabled={busy}
              >
                单次跑步
              </button>
            </div>
            {scope === 'run' && (
              <select
                className={styles.runSelect}
                aria-label="选择单次跑步"
                value={selectedRun?.run_id ?? ''}
                onChange={(event) => {
                  setSelectedRunId(Number(event.target.value));
                  setImageUrl(null);
                }}
                disabled={busy}
              >
                {runs.map((run) => (
                  <option key={run.run_id} value={run.run_id}>
                    {run.start_date_local.slice(0, 16)} · {run.name || '跑步'} ·{' '}
                    {(run.distance / 1000).toFixed(2)} km
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className={styles.group} role="group" aria-label="比例">
            {RATIOS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={ratio === item.value}
                className={ratio === item.value ? styles.active : ''}
                onClick={() => {
                  setRatio(item.value);
                  setImageUrl(null);
                }}
                disabled={busy}
              >
                {item.label}
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
          <div className={styles.group} role="group" aria-label="配色">
            {TONES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={tone === item.value}
                className={tone === item.value ? styles.active : ''}
                onClick={() => {
                  setTone(item.value);
                  setImageUrl(null);
                }}
                disabled={busy}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? '生成中…' : '保存图片'}
          </button>
          {!imageUrl && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => void buildImage()}
              disabled={busy}
            >
              生成后长按保存
            </button>
          )}
        </div>
        <p className={styles.hint}>
          {imageUrl
            ? '手机上长按图片即可保存到相册。'
            : `导出尺寸 ${RATIO_SIZES[ratio].width} × ${RATIO_SIZES[ratio].height}`}
        </p>
      </div>
    </div>
  );
};

export default SharePoster;
export type { PosterContent } from './render';
