// news-image-20261118-v2 — a broadsheet front page of Wednesday 18 November 2026.
// Node 22, standard library only, no network.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Writes out/entry.png, a 1024x1024 PNG, deterministic (same bytes every run).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [247, 243, 232];
const PANEL: RGB = [255, 252, 244];
const SHADE: RGB = [233, 227, 211];
const INK: RGB = [20, 33, 61];
const RED: RGB = [192, 57, 43];
const BLUE: RGB = [29, 111, 184];
const GOLD: RGB = [217, 164, 65];
const SKY: RGB = [174, 205, 235];

// ---------------------------------------------------------------- canvas ----
const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

// Filled rectangle, clipped to the canvas.
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

// Rectangle outline of thickness t, drawn inside the given box.
function borderRect(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, len: number, c: RGB): void {
  rect(x, y, len, 1, c);
}

function vline(x: number, y0: number, y1: number, c: RGB): void {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  rect(x, a, 1, b - a + 1, c);
}

// Bresenham line, 1 px thick.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Line of thickness t: stamp a disc of radius floor(t/2) on every Bresenham step.
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const r = Math.floor(t / 2);
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    disc(x0, y0, r, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, c);
    }
  }
}

// Ring of outer radius r and thickness t: pixels with (r-t)^2 < d^2 <= r^2.
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  const ro2 = r * r;
  const ri = r - t;
  const ri2 = ri * ri;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= ro2 && d2 > ri2) setPixel(x, y, c);
    }
  }
}

// Arc of radius r from angle a0 to a1 (radians), thickness t, stamped as discs.
function arc(cx: number, cy: number, r: number, a0: number, a1: number, t: number, c: RGB): void {
  const steps = Math.max(8, Math.ceil((a1 - a0) * r * 2));
  const rr = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    disc(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), rr, c);
  }
}

// ------------------------------------------------------------------ font ----
// 5x7 bitmap font. Each glyph is 7 row values; bit 4 is the leftmost pixel.
// Advance is 6 px per character (5 px glyph + 1 px space) times the scale.
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ";": [0, 12, 12, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "%": [25, 25, 2, 4, 8, 19, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "·": [0, 0, 0, 12, 12, 0, 0],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

function drawGlyph(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) rect(x + col * s, y + row * s, s, s, c);
    }
  }
}

// Uppercase text; (x, y) is the top-left of the first glyph.
function drawText(text: string, x: number, y: number, s: number, c: RGB): void {
  const t = text.toUpperCase();
  let cx = x;
  for (const ch of t) {
    drawGlyph(ch, cx, y, s, c);
    cx += 6 * s;
  }
}

function textWidth(text: string, s: number): number {
  const n = text.toUpperCase().length;
  return n === 0 ? 0 : n * 6 * s - s;
}

// Greedy word wrap. Throws instead of silently truncating.
function wrapText(text: string, maxW: number, s: number, maxLines: number): string[] {
  const words = text
    .toUpperCase()
    .split(" ")
    .filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (textWidth(w, s) > maxW) throw new Error("word too wide for wrap: " + w);
    const cand = cur ? cur + " " + w : w;
    if (textWidth(cand, s) <= maxW) {
      cur = cand;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    throw new Error("text needs " + lines.length + " lines, max " + maxLines + ": " + text);
  }
  return lines;
}

// -------------------------------------------------------------- PNG output ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// 8-bit RGB, filter 0 on every scanline, zlib level 9. Fully deterministic.
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- data ----
// The 7 stories, in fixed order. Facts are fixed verbatim; only presentation
// changes in this variant. dx/dy shift the pin away from its true point.
const STORIES = [
  {
    lat: 22.54,
    lon: 114.06,
    dx: 0,
    dy: 0,
    title: "TRUMP ARRIVES IN SHENZHEN AS XI AND PUTIN MEET",
    fact: "Xi and Putin hold talks at the APEC summit; Trump arrives from Manila. Three-way meeting set for Thursday.",
  },
  {
    lat: 39.11,
    lon: -76.75,
    dx: 0,
    dy: 0,
    title: "NSA CLASSIFIED NETWORK GOES DOWN IN US",
    fact: "NSANet, the NSA's classified internal network, went offline in routine maintenance; officials say not a cyberattack.",
  },
  {
    lat: -6.21,
    lon: 106.85,
    dx: 0,
    dy: 0,
    title: "INDONESIA AND CHINA SIGN $71.8B IN DEALS",
    fact: "Four partnerships including 10 smart cities, witnessed by President Prabowo at the APEC summit in Shenzhen.",
  },
  {
    lat: 61.22,
    lon: -149.9,
    dx: 0,
    dy: 0,
    title: "PELTOLA WINS ALASKA SENATE SEAT, FLIPPING IT FROM REPUBLICANS",
    fact: "Beats Dan Sullivan with 50.1% of first-choice votes; AP called the race Tuesday night.",
  },
  {
    lat: 18.3,
    lon: 84.5,
    dx: 0,
    dy: 0,
    title: "CYCLONE AKVAN NEARS COAST, ODISHA BRACES",
    fact: "Odisha moves coastal residents to shelters; landfall due Friday between Narsapur and Puri.",
  },
  {
    lat: 23.81,
    lon: 90.41,
    dx: 10,
    dy: -7,
    title: "BANGLADESH GARMENT WORKERS CLASH WITH POLICE",
    fact: "Workers demanding a higher wage clash with police near Dhaka; 132 factories shut in Ashulia.",
  },
  {
    lat: 52.21,
    lon: 0.12,
    dx: 0,
    dy: 0,
    title: "CAMBRIDGE NAMES 'HUMAN' WORD OF THE YEAR",
    fact: "Named for 2026, citing the debate over AI blurring people and machines.",
  },
];

const INDEX_LINES = [
  "TRUMP IN SHENZHEN, XI-PUTIN MEET",
  "NSA CLASSIFIED NETWORK DOWN",
  "INDONESIA-CHINA $71.8B DEALS",
  "PELTOLA WINS ALASKA SENATE SEAT",
  "CYCLONE AKVAN NEARS THE COAST",
  "BANGLADESH GARMENT CLASHES",
  "'HUMAN' NAMED WORD OF THE YEAR",
];

// Land grid: 64 columns x 32 rows, lat 84..-56. Per row, [start,end] column spans.
const MAP_SPANS: number[][][] = [
  [[17, 19], [22, 24]],
  [[15, 20], [21, 26]],
  [[3, 16], [21, 26], [28, 29], [33, 62]],
  [[4, 16], [21, 25], [32, 61]],
  [[5, 15], [29, 37], [36, 60]],
  [[6, 14], [29, 37], [40, 59]],
  [[7, 15], [29, 37], [40, 56]],
  [[7, 16], [29, 36], [40, 54]],
  [[8, 20], [29, 36], [37, 39], [44, 52], [56, 58]],
  [[8, 19], [29, 32], [37, 39], [44, 50], [55, 57]],
  [[9, 19], [29, 39], [37, 38], [44, 48], [55, 56]],
  [[10, 14], [29, 39], [37, 39], [45, 48]],
  [[11, 14], [29, 39], [37, 40], [45, 47]],
  [[13, 24], [30, 39], [37, 41], [47, 49]],
  [[17, 25], [31, 39], [37, 39], [48, 50]],
  [[18, 25], [31, 38], [49, 56]],
  [[18, 24], [31, 38], [50, 55]],
  [[18, 23], [32, 37], [49, 57]],
  [[19, 22], [31, 37], [50, 57]],
  [[19, 22], [32, 38], [52, 57]],
  [[19, 21], [32, 38], [51, 58]],
  [[20, 21], [32, 37], [52, 58]],
  [[20, 21], [33, 36], [51, 59]],
  [[20, 20], [33, 36], [51, 59]],
  [[20, 20], [34, 35], [52, 58]],
  [[20, 21], [34, 35], [53, 56]],
  [[20, 21], [34, 35]],
  [[20, 20], [35, 35], [61, 62]],
  [[20, 20], [35, 35], [61, 63]],
  [[55, 56], [61, 62]],
  [[20, 20]],
]; // rows 0..30; row 31 (lat -51.6..-56) has no land spans

const MAP = { x: 56, y: 752, w: 488, h: 196 };

function project(lon: number, lat: number): [number, number] {
  return [
    Math.round(MAP.x + ((lon + 180) / 360) * MAP.w),
    Math.round(MAP.y + ((84 - lat) / 140) * MAP.h),
  ];
}

// ----------------------------------------------------------------- layout ----

// A. Masthead.
function drawMasthead(): void {
  rect(40, 14, 72, 72, RED);
  drawText("18", 49, 22, 5, PAPER);
  drawText("NOV", 58, 64, 2, PAPER);
  drawText("THE DAY IN WORLD NEWS", 128, 18, 5, INK);
  drawText("WEDNESDAY 18 NOVEMBER 2026 · 7 STORIES · 5 REGIONS", 128, 60, 2, BLUE);
  rect(40, 94, 944, 3, INK);
  rect(40, 100, 944, 1, GOLD);
}

// B. Number strip, y 110..154.
function drawStrip(): void {
  rect(40, 110, 944, 2, INK);
  rect(40, 154, 944, 2, INK);
  for (const sx of [276, 512, 748]) vline(sx, 114, 150, GOLD);
  const cells: [string, string][] = [
    ["$71.8B", "DEALS IN SHENZHEN"],
    ["50.1%", "PELTOLA VOTE SHARE"],
    ["132", "FACTORIES SHUT"],
    ["110 KM/H", "AKVAN TOP GUSTS"],
  ];
  const xs = [40, 276, 512, 748];
  cells.forEach(([num, label], i) => {
    drawText(num, xs[i] + 14, 114, 3, INK);
    drawText(label, xs[i] + 14, 138, 2, BLUE);
  });
}

// C. Lead cards (stories 1..3), y 162, height 280.
// DEVIATION (see BUILD-REPORT.md): the three lead facts each wrap to 6 lines
// at width 284, scale 2 (story 2's fact is 117 chars; 5 lines hold at most
// 5*23 = 115), so the spec's 5-line cap cannot hold. Facts therefore start
// at y 351 (not 356) with pitch 15, so 6 lines end at 439, inside the card
// (border at 440..441), with a 1 px gap under a 3-line title.
function drawLeadCards(): void {
  const xs = [40, 360, 680];
  for (let k = 0; k < 3; k++) {
    const x = xs[k];
    const s = STORIES[k];
    rect(x, 162, 304, 280, PANEL);
    borderRect(x, 162, 304, 280, 2, INK);
    rect(x, 162, 304, 4, GOLD);
    drawScene(k, x + 10, 176);
    disc(x + 24, 316, 13, RED);
    drawText(String(k + 1), x + 19, 309, 2, PAPER);
    const title = wrapText(s.title, 250, 2, 3);
    title.forEach((ln, i) => drawText(ln, x + 46, 306 + i * 15, 2, INK));
    const fact = wrapText(s.fact, 284, 2, 6);
    fact.forEach((ln, i) => drawText(ln, x + 10, 351 + i * 15, 2, BLUE));
    console.log("lead " + (k + 1) + ": title " + title.length + " lines, fact " + fact.length + " lines");
  }
}

// Illustration scenes, in the 284x118 area starting at (ox, oy).
function drawScene(k: number, ox: number, oy: number): void {
  if (k === 0) {
    // Shenzhen: sky, sun, towers, two flags.
    rect(ox, oy, 284, 118, SKY);
    disc(ox + 232, oy + 26, 16, GOLD);
    rect(ox + 8, oy + 64, 44, 54, INK);
    rect(ox + 58, oy + 48, 30, 70, INK);
    rect(ox + 94, oy + 72, 52, 46, INK);
    rect(ox + 210, oy + 58, 36, 60, INK);
    rect(ox + 252, oy + 74, 26, 44, INK);
    vline(ox + 160, oy + 30, oy + 92, INK);
    vline(ox + 186, oy + 30, oy + 92, INK);
    rect(ox + 162, oy + 30, 22, 13, RED);
    rect(ox + 188, oy + 30, 22, 13, PAPER);
    borderRect(ox + 188, oy + 30, 22, 13, 1, INK);
    rect(ox + 188, oy + 34, 22, 3, RED);
    rect(ox + 188, oy + 39, 22, 3, RED);
    rect(ox, oy + 112, 284, 6, INK);
  } else if (k === 1) {
    // NSA: dark network, gold links, red offline node, padlock.
    rect(ox, oy, 284, 118, INK);
    const nodes: [number, number][] = [
      [36, 30],
      [96, 74],
      [150, 26],
      [208, 70],
      [252, 30],
    ];
    const links: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 2],
    ];
    for (const [a, b] of links) {
      line(ox + nodes[a][0], oy + nodes[a][1], ox + nodes[b][0], oy + nodes[b][1], GOLD);
    }
    for (const [nx, ny] of nodes) disc(ox + nx, oy + ny, 5, BLUE);
    disc(ox + 142, oy + 88, 8, RED);
    thickLine(ox + 137, oy + 83, ox + 147, oy + 93, 2, PAPER);
    thickLine(ox + 147, oy + 83, ox + 137, oy + 93, 2, PAPER);
    rect(ox + 196, oy + 84, 20, 16, GOLD);
    arc(ox + 206, oy + 84, 6, Math.PI, 2 * Math.PI, 2, GOLD);
  } else {
    // Indonesia-China: two skylines, gold arc, three coins.
    rect(ox, oy, 284, 118, SKY);
    rect(ox + 10, oy + 66, 34, 52, INK);
    rect(ox + 48, oy + 52, 26, 66, INK);
    rect(ox + 78, oy + 76, 30, 42, INK);
    rect(ox + 176, oy + 60, 30, 58, INK);
    rect(ox + 210, oy + 44, 26, 74, INK);
    rect(ox + 240, oy + 70, 34, 48, INK);
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const mt = 1 - t;
      const bx = mt * mt * 92 + 2 * mt * t * 134 + t * t * 176;
      const by = mt * mt * 96 + 2 * mt * t * 40 + t * t * 96;
      disc(Math.round(ox + bx), Math.round(oy + by), 2, GOLD);
    }
    const coins: [number, number][] = [
      [60, 26],
      [134, 18],
      [208, 26],
    ];
    for (const [cx, cy] of coins) {
      disc(ox + cx, oy + cy, 9, GOLD);
      drawText("$", ox + cx - 5, oy + cy - 7, 2, INK);
    }
    rect(ox, oy + 112, 284, 6, INK);
  }
}

// D. Small cards (stories 4..7), y 458, height 240.
function drawSmallCards(): void {
  const xs = [40, 280, 520, 760];
  for (let k = 0; k < 4; k++) {
    const x = xs[k];
    const s = STORIES[3 + k];
    rect(x, 458, 224, 240, PANEL);
    borderRect(x, 458, 224, 240, 2, INK);
    drawIcon(3 + k, x + 10, 470);
    disc(x + 198, 482, 12, RED);
    drawText(String(4 + k), x + 193, 475, 2, PAPER);
    const title = wrapText(s.title, 204, 2, 4);
    title.forEach((ln, i) => drawText(ln, x + 10, 512 + i * 15, 2, INK));
    const fact = wrapText(s.fact, 204, 2, 7);
    fact.forEach((ln, i) => drawText(ln, x + 10, 580 + i * 15, 2, BLUE));
    console.log("small " + (4 + k) + ": title " + title.length + " lines, fact " + fact.length + " lines");
  }
}

// 30 px icons on a 24-unit grid, drawn with the same primitives.
function drawIcon(k: number, bx: number, by: number): void {
  const S = 30 / 24;
  const X = (u: number): number => bx + Math.round(u * S);
  const Y = (v: number): number => by + Math.round(v * S);
  const Wd = (w: number): number => Math.max(1, Math.round(w * S));
  const irect = (u: number, v: number, w: number, h: number, c: RGB): void =>
    rect(X(u), Y(v), Wd(w), Wd(h), c);
  const idisc = (u: number, v: number, r: number, c: RGB): void =>
    disc(X(u), Y(v), Math.max(1, Math.round(r * S)), c);
  const ivline = (u: number, v0: number, v1: number, c: RGB): void => vline(X(u), Y(v0), Y(v1), c);
  const ithick = (u0: number, v0: number, u1: number, v1: number, t: number, c: RGB): void =>
    thickLine(X(u0), Y(v0), X(u1), Y(v1), t, c);
  if (k === 3) {
    // Capitol: dome, flag, columns, base.
    ivline(12, 0, 4, INK);
    irect(12, 1, 5, 2, RED);
    idisc(12, 9, 5, INK);
    irect(6, 9, 12, 6, PANEL); // cut the dome's lower half
    irect(4, 10, 16, 2, INK);
    irect(5, 12, 2, 6, INK);
    irect(11, 12, 2, 6, INK);
    irect(17, 12, 2, 6, INK);
    irect(4, 18, 16, 2, INK);
    irect(2, 20, 20, 2, INK);
  } else if (k === 4) {
    // Storm: cloud, gold lightning, blue rain.
    irect(5, 11, 18, 4, INK);
    idisc(8, 11, 4, INK);
    idisc(13, 9, 5, INK);
    idisc(19, 11, 4, INK);
    ithick(14, 15, 10, 20, 2, GOLD);
    ithick(10, 20, 13, 20, 2, GOLD);
    ithick(13, 20, 9, 24, 2, GOLD);
    ivline(6, 17, 20, BLUE);
    ivline(21, 17, 20, BLUE);
  } else if (k === 5) {
    // Factory: chimney with smoke, stepped roof, windows, door.
    irect(4, 5, 3, 8, INK);
    irect(4, 5, 3, 2, RED);
    idisc(5, 2, 1, GOLD);
    irect(3, 12, 18, 8, INK);
    irect(3, 10, 6, 2, INK);
    irect(9, 8, 6, 4, INK);
    irect(15, 10, 6, 2, INK);
    irect(6, 14, 2, 2, PANEL);
    irect(11, 14, 2, 2, PANEL);
    irect(16, 14, 2, 2, PANEL);
    irect(11, 17, 3, 3, PANEL);
    irect(2, 20, 20, 2, INK);
  } else {
    // Book: cover, two pages with text lines, red bookmark.
    irect(3, 6, 18, 12, INK);
    irect(4, 7, 7, 10, PAPER);
    irect(13, 7, 7, 10, PAPER);
    irect(5, 9, 5, 1, INK);
    irect(5, 12, 5, 1, INK);
    irect(5, 15, 5, 1, INK);
    irect(14, 9, 5, 1, INK);
    irect(14, 12, 5, 1, INK);
    irect(14, 15, 5, 1, INK);
    irect(17, 4, 2, 6, RED);
  }
}

// E. Bottom panel: dotted world map with numbered pins + day-in-brief index.
// DEVIATION (see BUILD-REPORT.md): index rows 1 (33 chars, 394 px) and 4
// (31 chars, 370 px) do not fit the right panel at scale 2 (360 px free
// from x 620 to the panel edge), so index text is drawn at scale 1,
// vertically centred against its scale-2 number (text at y+4). Numbers stay
// RED scale 2 as specified.
function drawBottom(): void {
  rect(40, 714, 520, 254, PANEL);
  borderRect(40, 714, 520, 254, 2, INK);
  drawText("WHERE IT HAPPENED", 56, 726, 2, INK);
  drawMap();
  rect(576, 714, 408, 254, PANEL);
  borderRect(576, 714, 408, 254, 2, INK);
  drawText("THE DAY IN BRIEF", 592, 726, 2, INK);
  INDEX_LINES.forEach((t, i) => {
    const y = 762 + i * 28;
    drawText(String(i + 1), 592, y, 2, RED);
    drawText(t, 620, y + 4, 1, INK);
  });
}

function drawMap(): void {
  // Graticule: gold dots every 30 degrees, stepped every 3 px.
  for (let lon = -180; lon <= 150; lon += 30) {
    const x = Math.round(MAP.x + ((lon + 180) / 360) * MAP.w);
    for (let y = MAP.y; y < MAP.y + MAP.h; y += 3) setPixel(x, y, GOLD);
  }
  for (let lat = 84; lat >= -36; lat -= 30) {
    const y = Math.round(MAP.y + ((84 - lat) / 140) * MAP.h);
    for (let x = MAP.x; x < MAP.x + MAP.w; x += 3) setPixel(x, y, GOLD);
  }
  // Land: one blue disc per land cell.
  for (let r = 0; r < MAP_SPANS.length; r++) {
    for (const [c0, c1] of MAP_SPANS[r]) {
      for (let c = c0; c <= c1; c++) {
        const lon = -180 + (c + 0.5) * (360 / 64);
        const lat = 84 - (r + 0.5) * (140 / 32);
        const [x, y] = project(lon, lat);
        disc(x, y, 3, BLUE);
      }
    }
  }
  // Frame, offset 2 px outside the map rect.
  borderRect(MAP.x - 2, MAP.y - 2, MAP.w + 4, MAP.h + 4, 2, INK);
  // Pins. Dhaka (story 6) is offset with a leader line to its true point.
  STORIES.forEach((s, i) => {
    const [tx, ty] = project(s.lon, s.lat);
    const cx = tx + s.dx;
    const cy = ty + s.dy;
    if (s.dx !== 0 || s.dy !== 0) {
      line(tx, ty, cx, cy, RED);
      disc(tx, ty, 3, RED);
    }
    disc(cx, cy, 10, RED);
    ring(cx, cy, 10, 2, PAPER);
    drawText(String(i + 1), cx - 2, cy - 3, 1, PAPER);
    console.log("pin " + (i + 1) + ": true (" + tx + "," + ty + ") drawn (" + cx + "," + cy + ")");
  });
}

// F. Footer.
function drawFooter(): void {
  const t = "SOURCES: REUTERS, AP, CNN, ANTARA AND OTHERS";
  drawText(t, 512 - Math.floor(textWidth(t, 2) / 2), 982, 2, INK);
}

function main(): void {
  fill(PAPER);
  drawMasthead();
  drawStrip();
  drawLeadCards();
  drawSmallCards();
  drawBottom();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}

main();
