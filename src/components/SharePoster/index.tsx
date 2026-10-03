import { useCallback, useEffect, useRef, useState } from 'react';
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

const SharePoster = ({ content, onClose }: SharePosterProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ratio, setRatio] = useState<PosterRatio>('3:4');
  const [tone, setTone] = useState<PosterTone>('light');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Preview is the same draw call as the export, just scaled — so what you
  // see is exactly what downloads.
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
      drawPoster(ctx, content, ratio, tone);
    };
    void paint();
    return () => {
      cancelled = true;
    };
  }, [content, ratio, tone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl]
  );

  const buildImage = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await posterToBlob(content, ratio, tone);
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
  }, [content, ratio, tone]);

  const handleSave = useCallback(async () => {
    const made = await buildImage();
    if (!made) return;
    const link = document.createElement('a');
    link.href = made.url;
    link.download = `running-${content.dateLine.replace(/[^\d]+/g, '')}-${ratio.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [buildImage, content.dateLine, ratio]);

  return (
    <div
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
          <button type="button" onClick={onClose} aria-label="关闭">
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
