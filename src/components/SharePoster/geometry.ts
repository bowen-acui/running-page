import * as mapboxPolyline from '@mapbox/polyline';

export interface Point {
  x: number;
  y: number;
}

/** A route normalised into a 0-100 square, plus the ground it actually covers. */
export interface NormalizedRoute {
  points: Point[];
  /** Width of the route's bounding box, in kilometres. */
  extentKm: number;
}

const KM_PER_LAT_DEGREE = 110.574;
const KM_PER_LNG_DEGREE_AT_EQUATOR = 111.32;

/**
 * Resample to evenly spaced points. The stored `summary_polyline` is a
 * simplified track — a 2.6 km loop can be as few as 17 points — so segments
 * vary wildly in length. Even spacing keeps the smoothing pass from pinching
 * the shape where the source happened to be dense.
 */
const resample = (points: Point[], count: number): Point[] => {
  if (points.length < 2) return points;

  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return points;

  const out: Point[] = [];
  let cursor = 0;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / (count - 1);
    while (cursor < cumulative.length - 2 && cumulative[cursor + 1] < target) {
      cursor += 1;
    }
    const span = cumulative[cursor + 1] - cumulative[cursor];
    const t = span <= 0 ? 0 : (target - cumulative[cursor]) / span;
    out.push({
      x: points[cursor].x + (points[cursor + 1].x - points[cursor].x) * t,
      y: points[cursor].y + (points[cursor + 1].y - points[cursor].y) * t,
    });
  }
  return out;
};

/** Three light smoothing passes — enough to round GPS corners, not enough to
 *  drift off the real shape. */
const smooth = (points: Point[], passes = 3): Point[] => {
  let current = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: Point[] = [current[0]];
    for (let i = 1; i < current.length - 1; i += 1) {
      next.push({
        x: (current[i - 1].x + 2 * current[i].x + current[i + 1].x) / 4,
        y: (current[i - 1].y + 2 * current[i].y + current[i + 1].y) / 4,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
};

/**
 * Decode one or more activities into a shared 0-100 coordinate square.
 *
 * All routes are normalised together against one bounding box so an overlay of
 * a week's runs keeps their true relative position and scale. Longitude is
 * scaled by cos(latitude) so shapes are not stretched away from the equator.
 */
export const normalizeRoutes = (
  polylines: readonly string[],
  padding = 14
): NormalizedRoute[] => {
  const decoded = polylines
    .map((line) => {
      try {
        return mapboxPolyline.decode(line) as [number, number][];
      } catch {
        return [];
      }
    })
    .filter((coords) => coords.length > 1);

  if (!decoded.length) return [];

  const allLats = decoded.flatMap((coords) => coords.map(([lat]) => lat));
  const allLngs = decoded.flatMap((coords) => coords.map(([, lng]) => lng));
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const midLat = (minLat + maxLat) / 2;

  const kmPerLng =
    KM_PER_LNG_DEGREE_AT_EQUATOR * Math.cos((midLat * Math.PI) / 180);
  const widthKm = (maxLng - minLng) * kmPerLng;
  const heightKm = (maxLat - minLat) * KM_PER_LAT_DEGREE;
  const spanKm = Math.max(widthKm, heightKm) || 1e-9;

  const scale = (100 - 2 * padding) / spanKm;
  const offsetX = (100 - widthKm * scale) / 2;
  const offsetY = (100 - heightKm * scale) / 2;

  return decoded.map((coords) => {
    const raw = coords.map(([lat, lng]) => ({
      x: (lng - minLng) * kmPerLng * scale + offsetX,
      // canvas y grows downward; latitude grows north, so flip
      y: 100 - ((lat - minLat) * KM_PER_LAT_DEGREE * scale + offsetY),
    }));
    return {
      points: smooth(resample(raw, 160), 3),
      extentKm: Math.max(widthKm, heightKm),
    };
  });
};

/* ------------------------------------------------------------------ */
/* Contour field                                                       */
/* ------------------------------------------------------------------ */

interface Field {
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Distance-to-route field via a two-pass chamfer transform.
 *
 * Measuring every grid cell against every segment is O(cells × segments) and
 * gets slow once a month of runs is overlaid; the chamfer sweep is O(cells)
 * and is more than accurate enough for decorative contour rings.
 */
const distanceField = (
  routes: readonly Point[][],
  gridWidth: number,
  gridHeight: number,
  project: (p: Point) => Point
): Field => {
  const data = new Float32Array(gridWidth * gridHeight).fill(Infinity);
  const at = (x: number, y: number) => y * gridWidth + x;

  const seed = (px: number, py: number) => {
    const x = Math.round(px);
    const y = Math.round(py);
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return;
    data[at(x, y)] = 0;
  };

  routes.forEach((points) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = project(points[i]);
      const b = project(points[i + 1]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        seed(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
  });

  const STRAIGHT = 1;
  const DIAGONAL = Math.SQRT2;
  const relax = (index: number, from: number, cost: number) => {
    const candidate = data[from] + cost;
    if (candidate < data[index]) data[index] = candidate;
  };

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const i = at(x, y);
      if (x > 0) relax(i, at(x - 1, y), STRAIGHT);
      if (y > 0) relax(i, at(x, y - 1), STRAIGHT);
      if (x > 0 && y > 0) relax(i, at(x - 1, y - 1), DIAGONAL);
      if (x < gridWidth - 1 && y > 0) relax(i, at(x + 1, y - 1), DIAGONAL);
    }
  }
  for (let y = gridHeight - 1; y >= 0; y -= 1) {
    for (let x = gridWidth - 1; x >= 0; x -= 1) {
      const i = at(x, y);
      if (x < gridWidth - 1) relax(i, at(x + 1, y), STRAIGHT);
      if (y < gridHeight - 1) relax(i, at(x, y + 1), STRAIGHT);
      if (x < gridWidth - 1 && y < gridHeight - 1) {
        relax(i, at(x + 1, y + 1), DIAGONAL);
      }
      if (x > 0 && y < gridHeight - 1) relax(i, at(x - 1, y + 1), DIAGONAL);
    }
  }

  return { data, width: gridWidth, height: gridHeight };
};

export type ContourSegment = [number, number, number, number];

/** Marching squares over the distance field — one iso-line per level. */
const traceLevel = (
  field: Field,
  level: number,
  cellW: number,
  cellH: number
): ContourSegment[] => {
  const segments: ContourSegment[] = [];
  const { data, width, height } = field;
  const value = (x: number, y: number) => data[y * width + x];
  const lerp = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    va: number,
    vb: number
  ): [number, number] => {
    const denominator = vb - va;
    const t = denominator === 0 ? 0.5 : (level - va) / denominator;
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const v = [
        value(x, y),
        value(x + 1, y),
        value(x + 1, y + 1),
        value(x, y + 1),
      ];
      let mask = 0;
      for (let k = 0; k < 4; k += 1) if (v[k] > level) mask |= 1 << k;
      if (mask === 0 || mask === 15) continue;

      const cx = [x, x + 1, x + 1, x].map((n) => n * cellW);
      const cy = [y, y, y + 1, y + 1].map((n) => n * cellH);

      const crossings: [number, number][] = [];
      for (let k = 0; k < 4; k += 1) {
        const a = k;
        const b = (k + 1) % 4;
        if (v[a] > level !== v[b] > level) {
          crossings.push(lerp(cx[a], cy[a], cx[b], cy[b], v[a], v[b]));
        }
      }
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        segments.push([
          crossings[k][0],
          crossings[k][1],
          crossings[k + 1][0],
          crossings[k + 1][1],
        ]);
      }
    }
  }
  return segments;
};

export interface ContourRing {
  segments: ContourSegment[];
  index: number;
}

/**
 * Contour rings radiating out from the routes, in pixel space.
 * These read as topographic relief while actually encoding "how far this run
 * ranged" — which is what the cover is meant to say.
 */
export const buildContours = (
  routes: readonly Point[][],
  width: number,
  height: number,
  project: (p: Point) => Point,
  ringCount = 22
): ContourRing[] => {
  if (!routes.length) return [];

  const target = 190;
  const gridWidth = Math.max(
    48,
    Math.round(width >= height ? target : (target * width) / height)
  );
  const gridHeight = Math.max(
    48,
    Math.round(height > width ? target : (target * height) / width)
  );
  const cellW = width / (gridWidth - 1);
  const cellH = height / (gridHeight - 1);

  const field = distanceField(routes, gridWidth, gridHeight, (p) => {
    const q = project(p);
    return { x: q.x / cellW, y: q.y / cellH };
  });

  const unit = (width * 0.02) / Math.min(cellW, cellH);
  const rings: ContourRing[] = [];
  for (let k = 1; k <= ringCount; k += 1) {
    const level = unit * Math.pow(k, 1.14);
    const segments = traceLevel(field, level, cellW, cellH);
    if (segments.length) rings.push({ segments, index: rings.length });
  }
  return rings;
};
