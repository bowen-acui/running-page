import { buildContours, normalizeRoutes, type Point } from './geometry';

export type PosterRatio = '3:4' | '1:1';
export type PosterTone = 'light' | 'dark';

export interface PosterContent {
  /** Big line above the numbers — the run's name, or "本月跑量". */
  kicker: string;
  /** Date or date range, left of the thin rule. */
  dateLine: string;
  /** Athlete and context, right of the thin rule. */
  metaLine: string;
  /** The hero number, already formatted (e.g. "7.61"). */
  distance: string;
  /** The other hero, already formatted (e.g. "44'06\""). */
  duration: string;
  /** Small signature row under the numbers. */
  footnote: string;
  polylines: readonly string[];
}

interface Palette {
  paper: string;
  contour: string;
  route: string;
  ink: string;
  dim: string;
  rule: string;
  pop: string;
}

const PALETTES: Record<PosterTone, Palette> = {
  light: {
    paper: '#f4efe4',
    contour: '#cfc6b4',
    route: '#0a5570',
    ink: '#0a3346',
    dim: '#8a8272',
    rule: '#cfc6b4',
    pop: '#c9f43d',
  },
  dark: {
    paper: '#101d24',
    contour: '#2b3d46',
    route: '#e8f27a',
    ink: '#f0f4f1',
    dim: '#8fa2a8',
    rule: '#2b3d46',
    pop: '#c9f43d',
  },
};

export const RATIO_SIZES: Record<
  PosterRatio,
  { width: number; height: number }
> = {
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 },
};

const COND = '"IBM Plex Sans Condensed", "Noto Sans SC", sans-serif';
const MONO = '"IBM Plex Mono", monospace';
const SANS = '"IBM Plex Sans", "Noto Sans SC", sans-serif';

/** Letter-spaced fills — canvas has no letterSpacing in older Safari. */
const drawTracked = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: 'left' | 'right' = 'left'
) => {
  const chars = [...text];
  const total =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    tracking * Math.max(0, chars.length - 1);
  let cursor = align === 'right' ? x - total : x;
  chars.forEach((ch) => {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  });
  return total;
};

/**
 * Draw the whole poster at `width × height`.
 *
 * Everything is drawn with the Canvas 2D API rather than serialising an SVG:
 * an SVG rasterised through an <img> loses webfonts unless they are inlined as
 * base64, whereas canvas text uses the fonts the document already loaded.
 */
export const drawPoster = (
  ctx: CanvasRenderingContext2D,
  content: PosterContent,
  ratio: PosterRatio,
  tone: PosterTone
) => {
  const { width, height } = RATIO_SIZES[ratio];
  const palette = PALETTES[tone];

  ctx.save();
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);

  const pad = width * 0.072;
  const bandHeight = height * (height > width ? 0.615 : 0.6);
  const infoY = bandHeight + height * (height > width ? 0.052 : 0.058);
  const bigY = height * 0.845;

  const routes = normalizeRoutes(content.polylines).map((r) => r.points);
  const extentKm = normalizeRoutes(content.polylines)[0]?.extentKm ?? 0;

  if (routes.length) {
    // Routes live in a 0-100 square, so they must map onto a square region —
    // fitting them to the band rectangle would stretch the shape. Size that
    // square to cover the band so the drawing bleeds off the edges.
    const square = Math.max(width, bandHeight) * 1.18;
    const originX = (width - square) / 2;
    const originY = (bandHeight - square) / 2;
    const project = (p: Point): Point => ({
      x: originX + (p.x / 100) * square,
      y: originY + (p.y / 100) * square,
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, bandHeight);
    ctx.clip();

    const rings = buildContours(routes, width, bandHeight, project);
    rings.forEach((ring, index) => {
      ctx.beginPath();
      ring.segments.forEach(([x1, y1, x2, y2]) => {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
      ctx.strokeStyle = palette.contour;
      ctx.globalAlpha = Math.max(0.18, 0.95 - 0.035 * index);
      ctx.lineWidth = width * (index % 4 === 0 ? 0.0026 : 0.0016);
      ctx.lineCap = 'round';
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    routes.forEach((points, index) => {
      const isPrimary = index === routes.length - 1;
      ctx.beginPath();
      points.forEach((p, i) => {
        const q = project(p);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.strokeStyle = palette.route;
      ctx.globalAlpha = isPrimary ? 1 : 0.34;
      ctx.lineWidth = width * (isPrimary ? 0.0115 : 0.0072);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    const primary = routes[routes.length - 1];
    if (primary?.length) {
      const start = project(primary[0]);
      ctx.beginPath();
      ctx.arc(start.x, start.y, width * 0.0105, 0, Math.PI * 2);
      ctx.fillStyle = palette.paper;
      ctx.fill();
      ctx.strokeStyle = palette.route;
      ctx.lineWidth = width * 0.0052;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── thin info band ────────────────────────────────────────────────
  const rule = (y: number) => {
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = width * 0.0018;
    ctx.stroke();
  };
  rule(infoY - height * 0.03);
  rule(infoY + height * 0.02);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.ink;
  ctx.font = `500 ${width * 0.03}px ${MONO}`;
  ctx.textAlign = 'left';
  drawTracked(ctx, content.dateLine, pad, infoY, width * 0.0035);

  ctx.fillStyle = palette.dim;
  ctx.font = `${width * 0.026}px ${MONO}`;
  drawTracked(
    ctx,
    content.metaLine,
    width - pad,
    infoY,
    width * 0.003,
    'right'
  );

  // ── the two heroes: distance and time ─────────────────────────────
  const eyebrowY = bigY - width * 0.128;
  ctx.fillStyle = palette.dim;
  ctx.font = `500 ${width * 0.034}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(content.kicker, pad, eyebrowY);

  ctx.font = `${width * 0.024}px ${MONO}`;
  drawTracked(ctx, 'TIME', width - pad, eyebrowY, width * 0.006, 'right');

  // Distance and duration share one line, and both can run long — a year view
  // pairs "180.5" with "15H21'07"". Measure first and shrink the whole row to
  // fit rather than letting the two collide in the middle.
  const gapToUnit = width * 0.02;
  const minGapBetween = width * 0.045;
  const available = width - pad * 2;

  let distanceSize = width * 0.148;
  let unitSize = width * 0.052;
  let durationSize = width * 0.104;

  const measureRow = () => {
    ctx.font = `700 ${distanceSize}px ${COND}`;
    const d = ctx.measureText(content.distance).width;
    ctx.font = `700 ${unitSize}px ${COND}`;
    const u = ctx.measureText('KM').width;
    ctx.font = `700 ${durationSize}px ${COND}`;
    const t = ctx.measureText(content.duration).width;
    return { d, u, t, total: d + gapToUnit + u + minGapBetween + t };
  };

  let row = measureRow();
  if (row.total > available) {
    const scale = available / row.total;
    distanceSize *= scale;
    unitSize *= scale;
    durationSize *= scale;
    row = measureRow();
  }

  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${distanceSize}px ${COND}`;
  ctx.textAlign = 'left';
  ctx.fillText(content.distance, pad, bigY);

  ctx.fillStyle = palette.route;
  ctx.font = `700 ${unitSize}px ${COND}`;
  ctx.fillText('KM', pad + row.d + gapToUnit, bigY);

  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${durationSize}px ${COND}`;
  ctx.textAlign = 'right';
  ctx.fillText(content.duration, width - pad, bigY);

  // ── signature row ─────────────────────────────────────────────────
  const footY = bigY + width * 0.062;
  ctx.fillStyle = palette.dim;
  ctx.textAlign = 'left';
  const footnote = extentKm
    ? `${content.footnote}   ·   范围 ${extentKm.toFixed(1)} km`
    : content.footnote;

  // Keep the signature clear of the accent block on the right.
  const footRoom = width - pad * 2 - width * 0.09;
  let footSize = width * 0.024;
  ctx.font = `${footSize}px ${MONO}`;
  const footWidth = ctx.measureText(footnote).width;
  if (footWidth > footRoom) {
    footSize *= footRoom / footWidth;
    ctx.font = `${footSize}px ${MONO}`;
  }
  drawTracked(ctx, footnote, pad, footY, width * 0.002);

  ctx.fillStyle = palette.pop;
  ctx.fillRect(
    width - pad - width * 0.062,
    footY - width * 0.02,
    width * 0.062,
    width * 0.016
  );

  ctx.restore();
};

/** Render at export resolution and hand back a PNG blob. */
export const posterToBlob = async (
  content: PosterContent,
  ratio: PosterRatio,
  tone: PosterTone
): Promise<Blob | null> => {
  const { width, height } = RATIO_SIZES[ratio];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall through to system fallbacks */
    }
  }
  drawPoster(ctx, content, ratio, tone);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
};
