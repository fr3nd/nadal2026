// A tiny pixel-art toolkit: sprites are painted from shapes (blobs, boxes,
// polygons) on a grid, with automatic cel shading and colored outlines.
// This is what gives the "Minish Cap" look: round shapes, 3-tone shading,
// and dark outlines tinted by the color they surround (never pure black).
// No DOM in here, so sprites can also be previewed from Node.

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export const mix = (a, b, t) => {
  const A = hex(a); const B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};
export const lighten = (c, t = 0.35) => mix(c, '#fff6e0', t);
export const darken = (c, t = 0.35) => mix(c, '#2a2f6b', t);
export const outlineOf = (c) => mix(c, '#14183f', 0.72);

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(null);
  }

  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (c && c.length === 4) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : null;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  // Generic filled shape: inside(px,py) -> normalized "radius" or null.
  fillShape(x0, y0, x1, y1, fn) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
    }
  }

  // Cel-shaded ellipse with its own outline.
  //   opts.line: outline color (default: tinted dark of base), false = none
  //   opts.shade: false = flat color
  blob(cx, cy, rx, ry, base, opts = {}) {
    const line = opts.line === undefined ? outlineOf(base) : opts.line;
    const light = opts.light || lighten(base, 0.38);
    const dark = opts.dark || darken(base, 0.32);
    const inside = (x, y, grow) => {
      const u = (x + 0.5 - cx) / (rx + grow);
      const v = (y + 0.5 - cy) / (ry + grow);
      return u * u + v * v <= 1;
    };
    this.fillShape(cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2, (x, y) => {
      if (line && !inside(x, y, 0) && inside(x, y, 1)) this.set(x, y, line);
    });
    this.fillShape(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
      if (!inside(x, y, 0)) return;
      let c = base;
      if (opts.shade !== false) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if ((u + 0.22) ** 2 + (v + 0.28) ** 2 > 0.95) c = dark;
        else if ((u + 0.42) ** 2 + (v + 0.5) ** 2 < 0.13) c = light;
      }
      this.set(x, y, c);
    });
  }

  // Rounded box with outline and simple shading (light top, dark bottom).
  box(x, y, w, h, base, opts = {}) {
    const line = opts.line === undefined ? outlineOf(base) : opts.line;
    const r = opts.round === undefined ? 1 : opts.round;
    const light = opts.light || lighten(base, 0.35);
    const dark = opts.dark || darken(base, 0.3);
    const inBox = (px, py, g) => {
      const x0 = x - g; const y0 = y - g; const x1 = x + w + g; const y1 = y + h + g;
      if (px < x0 || py < y0 || px >= x1 || py >= y1) return false;
      const rr = r + g;
      const dx = Math.max(x0 + rr - px - 0.5, 0, px + 0.5 - (x1 - rr));
      const dy = Math.max(y0 + rr - py - 0.5, 0, py + 0.5 - (y1 - rr));
      return dx * dx + dy * dy <= rr * rr + 0.01;
    };
    this.fillShape(x - 1, y - 1, x + w, y + h, (px, py) => {
      if (line && !inBox(px, py, 0) && inBox(px, py, 1)) this.set(px, py, line);
    });
    this.fillShape(x, y, x + w - 1, y + h - 1, (px, py) => {
      if (!inBox(px, py, 0)) return;
      let c = base;
      if (opts.shade !== false) {
        if (py >= y + h - Math.max(1, Math.round(h * 0.28))) c = dark;
        else if (py < y + 1 && h > 3) c = light;
      }
      this.set(px, py, c);
    });
  }

  // Filled polygon (even-odd), optional outline.
  poly(pts, base, opts = {}) {
    const line = opts.line === undefined ? outlineOf(base) : opts.line;
    const minY = Math.floor(Math.min(...pts.map((p) => p[1])));
    const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
    const minX = Math.floor(Math.min(...pts.map((p) => p[0])));
    const maxX = Math.ceil(Math.max(...pts.map((p) => p[0])));
    const inPoly = (px, py) => {
      let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    const mask = new Set();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) if (inPoly(x + 0.5, y + 0.5)) mask.add(y * 4096 + x);
    }
    if (line) {
      for (const k of mask) {
        const y = Math.floor(k / 4096); const x = k % 4096;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!mask.has((y + dy) * 4096 + x + dx)) this.set(x + dx, y + dy, line);
        }
      }
    }
    for (const k of mask) {
      const y = Math.floor(k / 4096); const x = k % 4096;
      let c = base;
      if (opts.shade !== false) {
        const cx = (minX + maxX) / 2;
        if (x >= cx + (maxX - minX) * 0.12) c = opts.dark || darken(base, 0.3);
        else if (x < cx - (maxX - minX) * 0.22 && y < minY + (maxY - minY) * 0.7) c = opts.light || lighten(base, 0.3);
      }
      this.set(x, y, c);
    }
  }

  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }

  // Dark outline around everything painted so far (grows the canvas by 1px).
  outlined(color = null) {
    const out = new Pix(this.w + 2, this.h + 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.d[(y + 1) * out.w + x + 1] = this.d[y * this.w + x];
    const add = [];
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        if (out.get(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = out.get(x + dx, y + dy);
          if (n) { add.push([x, y, color || outlineOf(n)]); break; }
        }
      }
    }
    add.forEach(([x, y, c]) => out.set(x, y, c));
    return out;
  }

  // Mirror horizontally.
  flipped() {
    const o = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return o;
  }

  // Draw another Pix on top (for composing parts).
  stamp(other, ox, oy) {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const c = other.d[y * other.w + x];
        if (c) this.set(ox + x, oy + y, c);
      }
    }
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const col = this.d[y * this.w + x];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }
}

// Build a Pix from text rows + palette (used for small UI icons).
export function fromRows(rows, palette) {
  const p = new Pix(rows[0].length, rows.length);
  rows.forEach((r, y) => {
    if (r.length !== p.w) throw new Error(`Row ${y} has ${r.length} chars, expected ${p.w}`);
    for (let x = 0; x < p.w; x++) if (r[x] !== '.') p.set(x, y, palette[r[x]] || '#f0f');
  });
  return p;
}
