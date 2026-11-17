import * as fontkit from 'fontkit';
import type { Font as FontkitFont, Glyph } from 'fontkit';
import { getFontEmbedCSS, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  getCanvasDimensions,
  PAPER_MM,
  PaperFormat,
  PaperOrientation,
} from '../types/epaper';

const TRANSPARENT_1X1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

interface CssRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ParsedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FontFaceEntry {
  family: string;
  style: string;
  weightMin: number;
  weightMax: number;
  ranges: Array<[number, number]>;
  url: string;
}

type VectorPathCmd =
  | { op: 'm'; args: [number, number] }
  | { op: 'l'; args: [number, number] }
  | { op: 'c'; args: [number, number, number, number, number, number] }
  | { op: 'h' };

function intersectRect(a: CssRect, b: CssRect): CssRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

let cachedColorCtx: CanvasRenderingContext2D | null = null;
const parsedColorCache = new Map<string, ParsedRgba | null>();

/**
 * Resolves any CSS Color Level 4 string (Tailwind v4 oklch/oklab/color-mix, rgb, rgba, hex)
 * into sRGB [r, g, b, a].
 */
function parseCssColor(colorStr: string): ParsedRgba | null {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'none') return null;
  if (parsedColorCache.has(colorStr)) return parsedColorCache.get(colorStr) ?? null;

  const rgbMatch = colorStr.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i
  );
  if (rgbMatch) {
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    const res =
      Number.isNaN(a) || a <= 0.005
        ? null
        : {
            r: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[1])))),
            g: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[2])))),
            b: Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[3])))),
            a: Math.min(1, Math.max(0, a)),
          };
    parsedColorCache.set(colorStr, res);
    return res;
  }

  if (!cachedColorCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    cachedColorCtx = c.getContext('2d', { willReadFrequently: true });
  }
  if (!cachedColorCtx) return null;

  cachedColorCtx.clearRect(0, 0, 1, 1);
  cachedColorCtx.fillStyle = 'rgba(0,0,0,0)';
  cachedColorCtx.fillStyle = colorStr;
  cachedColorCtx.fillRect(0, 0, 1, 1);
  const d = cachedColorCtx.getImageData(0, 0, 1, 1).data;
  const res = d[3] === 0 ? null : { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  parsedColorCache.set(colorStr, res);
  return res;
}

function blendOverPaper(
  fg: ParsedRgba,
  base: [number, number, number] = [253, 252, 248]
): [number, number, number] {
  if (fg.a >= 0.995) return [fg.r, fg.g, fg.b];
  return [
    Math.round(fg.r * fg.a + base[0] * (1 - fg.a)),
    Math.round(fg.g * fg.a + base[1] * (1 - fg.a)),
    Math.round(fg.b * fg.a + base[2] * (1 - fg.a)),
  ];
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

function parseGradientStops(
  bgImage: string,
  underlay: [number, number, number]
): Array<{ r: number; g: number; b: number; pos: number }> {
  const startIdx = bgImage.indexOf('linear-gradient(');
  if (startIdx === -1) return [];
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx + 'linear-gradient('.length; i < bgImage.length; i++) {
    if (bgImage[i] === '(') depth++;
    else if (bgImage[i] === ')') {
      if (depth === 0) {
        endIdx = i;
        break;
      }
      depth--;
    }
  }
  if (endIdx === -1) return [];

  const inner = bgImage.slice(startIdx + 'linear-gradient('.length, endIdx);
  const args = splitTopLevelCommas(inner);
  const rawStops: Array<{ r: number; g: number; b: number; explicitPos: number | null }> = [];

  for (const arg of args) {
    if (/^\d+(?:\.\d+)?deg$/i.test(arg) || /^to\s+/i.test(arg)) continue;
    const pctMatch = arg.match(/\s+([\d.]+)%\s*$/);
    const colorPart = pctMatch ? arg.slice(0, pctMatch.index).trim() : arg.trim();
    const parsed = parseCssColor(colorPart);
    if (!parsed) continue;
    const [r, g, b] = blendOverPaper(parsed, underlay);
    rawStops.push({
      r,
      g,
      b,
      explicitPos: pctMatch ? parseFloat(pctMatch[1]) / 100 : null,
    });
  }

  return rawStops.map((s, idx) => ({
    r: s.r,
    g: s.g,
    b: s.b,
    pos: s.explicitPos ?? idx / Math.max(1, rawStops.length - 1),
  }));
}

function interpolateGradient(
  stops: Array<{ r: number; g: number; b: number; pos: number }>,
  t: number
): [number, number, number] {
  if (stops.length === 0) return [255, 255, 255];
  if (t <= stops[0].pos) return [stops[0].r, stops[0].g, stops[0].b];
  if (t >= stops[stops.length - 1].pos) {
    const last = stops[stops.length - 1];
    return [last.r, last.g, last.b];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (t >= s0.pos && t <= s1.pos) {
      const span = s1.pos - s0.pos;
      const localT = span <= 0.0001 ? 1 : (t - s0.pos) / span;
      return [
        Math.round(s0.r + (s1.r - s0.r) * localT),
        Math.round(s0.g + (s1.g - s0.g) * localT),
        Math.round(s0.b + (s1.b - s0.b) * localT),
      ];
    }
  }
  return [stops[0].r, stops[0].g, stops[0].b];
}

/**
 * Draws inline SVG shapes (<circle>, <rect>, <line>, <path> with M/L/H/V/C/Q/T/Z)
 * directly as native infinite-zoom PDF vectors (e.g., FixedLogoBox emblem).
 */
function drawInlineSvgVectors(
  pdf: jsPDF,
  svgEl: SVGSVGElement,
  elRect: CssRect,
  sx: number,
  sy: number,
  bgUnderlay: [number, number, number]
): void {
  const sr = svgEl.getBoundingClientRect();
  if (sr.width <= 0 || sr.height <= 0) return;

  const vbAttr = svgEl.getAttribute('viewBox');
  const vb = vbAttr ? vbAttr.trim().split(/[\s,]+/).map(Number) : [0, 0, sr.width, sr.height];
  const [vbX, vbY, vbW, vbH] = vb.length === 4 ? vb : [0, 0, sr.width, sr.height];
  if (!vbW || !vbH) return;

  const svgMmX = (sr.left - elRect.left) * sx;
  const svgMmY = (sr.top - elRect.top) * sy;
  const uSx = (sr.width * sx) / vbW;
  const uSy = (sr.height * sy) / vbH;
  const tx = (x: number) => svgMmX + (x - vbX) * uSx;
  const ty = (y: number) => svgMmY + (y - vbY) * uSy;

  const applyPaint = (node: Element): { doFill: boolean; doStroke: boolean } => {
    const cs = window.getComputedStyle(node);
    const fillStr = node.getAttribute('fill') ?? cs.fill;
    const strokeStr = node.getAttribute('stroke') ?? cs.stroke;
    const swAttr = node.getAttribute('stroke-width');
    const sw = parseFloat(swAttr ?? cs.strokeWidth ?? '1') || 1;
    const cap = node.getAttribute('stroke-linecap') ?? cs.strokeLinecap ?? 'butt';

    let doFill = false;
    let doStroke = false;
    if (fillStr && fillStr !== 'none' && fillStr !== 'transparent') {
      const fc = parseCssColor(fillStr);
      if (fc) {
        const [r, g, b] = blendOverPaper(fc, bgUnderlay);
        pdf.setFillColor(r, g, b);
        doFill = true;
      }
    }
    if (strokeStr && strokeStr !== 'none' && strokeStr !== 'transparent') {
      const sc = parseCssColor(strokeStr);
      if (sc) {
        const [r, g, b] = blendOverPaper(sc, bgUnderlay);
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(sw * ((uSx + uSy) / 2));
        pdf.setLineCap(cap === 'round' ? 'round' : cap === 'square' ? 'square' : 'butt');
        doStroke = true;
      }
    }
    return { doFill, doStroke };
  };

  for (const child of Array.from(svgEl.children)) {
    const tag = child.tagName.toLowerCase();
    const { doFill, doStroke } = applyPaint(child);
    if (!doFill && !doStroke) continue;
    const mode = doFill && doStroke ? 'FD' : doFill ? 'F' : 'S';

    if (tag === 'circle') {
      const cx = parseFloat(child.getAttribute('cx') || '0');
      const cy = parseFloat(child.getAttribute('cy') || '0');
      const r = parseFloat(child.getAttribute('r') || '0');
      if (r > 0) pdf.circle(tx(cx), ty(cy), r * ((uSx + uSy) / 2), mode);
    } else if (tag === 'rect') {
      const x = parseFloat(child.getAttribute('x') || '0');
      const y = parseFloat(child.getAttribute('y') || '0');
      const w = parseFloat(child.getAttribute('width') || '0');
      const h = parseFloat(child.getAttribute('height') || '0');
      if (w > 0 && h > 0) pdf.rect(tx(x), ty(y), w * uSx, h * uSy, mode);
    } else if (tag === 'line') {
      const x1 = parseFloat(child.getAttribute('x1') || '0');
      const y1 = parseFloat(child.getAttribute('y1') || '0');
      const x2 = parseFloat(child.getAttribute('x2') || '0');
      const y2 = parseFloat(child.getAttribute('y2') || '0');
      pdf.line(tx(x1), ty(y1), tx(x2), ty(y2));
    } else if (tag === 'path') {
      const d = child.getAttribute('d') || '';
      const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
      let idx = 0;
      let curX = 0;
      let curY = 0;
      let startX = 0;
      let startY = 0;
      let lastCtrlX = 0;
      let lastCtrlY = 0;
      let lastOp = '';
      let activeCmd = '';
      let hasPath = false;

      const nextNum = () => parseFloat(tokens[idx++] || '0');
      while (idx < tokens.length) {
        if (/^[a-zA-Z]$/.test(tokens[idx])) {
          activeCmd = tokens[idx++];
        }
        const isRel = activeCmd === activeCmd.toLowerCase();
        const op = activeCmd.toUpperCase();
        if (op === 'M') {
          const x = nextNum() + (isRel ? curX : 0);
          const y = nextNum() + (isRel ? curY : 0);
          pdf.moveTo(tx(x), ty(y));
          curX = x;
          curY = y;
          startX = x;
          startY = y;
          lastOp = 'M';
          hasPath = true;
          activeCmd = isRel ? 'l' : 'L';
        } else if (op === 'L') {
          const x = nextNum() + (isRel ? curX : 0);
          const y = nextNum() + (isRel ? curY : 0);
          pdf.lineTo(tx(x), ty(y));
          curX = x;
          curY = y;
          lastOp = 'L';
        } else if (op === 'H') {
          const x = nextNum() + (isRel ? curX : 0);
          pdf.lineTo(tx(x), ty(curY));
          curX = x;
          lastOp = 'H';
        } else if (op === 'V') {
          const y = nextNum() + (isRel ? curY : 0);
          pdf.lineTo(tx(curX), ty(y));
          curY = y;
          lastOp = 'V';
        } else if (op === 'Q') {
          const qx = nextNum() + (isRel ? curX : 0);
          const qy = nextNum() + (isRel ? curY : 0);
          const x = nextNum() + (isRel ? curX : 0);
          const y = nextNum() + (isRel ? curY : 0);
          const c1x = curX + (2 / 3) * (qx - curX);
          const c1y = curY + (2 / 3) * (qy - curY);
          const c2x = x + (2 / 3) * (qx - x);
          const c2y = y + (2 / 3) * (qy - y);
          pdf.curveTo(tx(c1x), ty(c1y), tx(c2x), ty(c2y), tx(x), ty(y));
          lastCtrlX = qx;
          lastCtrlY = qy;
          curX = x;
          curY = y;
          lastOp = 'Q';
        } else if (op === 'T') {
          const qx = lastOp === 'Q' || lastOp === 'T' ? 2 * curX - lastCtrlX : curX;
          const qy = lastOp === 'Q' || lastOp === 'T' ? 2 * curY - lastCtrlY : curY;
          const x = nextNum() + (isRel ? curX : 0);
          const y = nextNum() + (isRel ? curY : 0);
          const c1x = curX + (2 / 3) * (qx - curX);
          const c1y = curY + (2 / 3) * (qy - curY);
          const c2x = x + (2 / 3) * (qx - x);
          const c2y = y + (2 / 3) * (qy - y);
          pdf.curveTo(tx(c1x), ty(c1y), tx(c2x), ty(c2y), tx(x), ty(y));
          lastCtrlX = qx;
          lastCtrlY = qy;
          curX = x;
          curY = y;
          lastOp = 'T';
        } else if (op === 'C') {
          const x1 = nextNum() + (isRel ? curX : 0);
          const y1 = nextNum() + (isRel ? curY : 0);
          const x2 = nextNum() + (isRel ? curX : 0);
          const y2 = nextNum() + (isRel ? curY : 0);
          const x = nextNum() + (isRel ? curX : 0);
          const y = nextNum() + (isRel ? curY : 0);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCtrlX = x2;
          lastCtrlY = y2;
          curX = x;
          curY = y;
          lastOp = 'C';
        } else if (op === 'Z') {
          pdf.close();
          curX = startX;
          curY = startY;
          lastOp = 'Z';
        } else {
          idx++;
        }
      }
      if (hasPath) {
        if (doFill && doStroke) pdf.fillStroke();
        else if (doFill) pdf.fill();
        else pdf.stroke();
      }
    }
  }
}

/**
 * LAYER 1: Draws all sheet backgrounds, colored banners, linear gradients, badges,
 * bullet dots, rotated markers, multi-column rules, inline SVGs, and all grid/double borders
 * as true infinite-zoom PDF vectors.
 */
function drawDomVectorsToPdf(
  pdf: jsPDF,
  rootEl: HTMLElement,
  elRect: CssRect,
  sx: number,
  sy: number,
  mmWidth: number,
  mmHeight: number
): void {
  const rootCs = window.getComputedStyle(rootEl);
  const rootBg = parseCssColor(rootCs.backgroundColor);
  const [paperR, paperG, paperB] = rootBg ? blendOverPaper(rootBg) : [253, 252, 248];

  pdf.setFillColor(paperR, paperG, paperB);
  pdf.rect(0, 0, mmWidth, mmHeight, 'F');

  const walk = (node: Element, clip: CssRect, bgUnderlay: [number, number, number]) => {
    const tag = node.tagName.toUpperCase();
    if (tag === 'IMG') return;

    const cs = window.getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0.01) {
      return;
    }

    if (node instanceof SVGSVGElement) {
      drawInlineSvgVectors(pdf, node, elRect, sx, sy, bgUnderlay);
      return;
    }

    const r = node.getBoundingClientRect();
    const vis = intersectRect(
      { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
      clip
    );

    if (vis.width <= 0.05 || vis.height <= 0.05) {
      return;
    }

    let nextBg = bgUnderlay;
    const isRoot = node === rootEl;

    if (!isRoot) {
      const mmX = (vis.left - elRect.left) * sx;
      const mmY = (vis.top - elRect.top) * sy;
      const mmW = vis.width * sx;
      const mmH = vis.height * sy;

      // Rotated vector markers (e.g., rotated 45deg diamond category marker)
      if (cs.transform && cs.transform !== 'none' && node instanceof HTMLElement) {
        const bg = parseCssColor(cs.backgroundColor);
        if (bg) {
          const [fr, fg, fb] = blendOverPaper(bg, bgUnderlay);
          const matrix = new DOMMatrix(cs.transform);
          const hw = (node.offsetWidth || r.width) / 2;
          const hh = (node.offsetHeight || r.height) / 2;
          const cx = (r.left + r.right) / 2 - elRect.left;
          const cy = (r.top + r.bottom) / 2 - elRect.top;
          const pts = [
            new DOMPoint(-hw, -hh).matrixTransform(matrix),
            new DOMPoint(hw, -hh).matrixTransform(matrix),
            new DOMPoint(hw, hh).matrixTransform(matrix),
            new DOMPoint(-hw, hh).matrixTransform(matrix),
          ].map((p) => ({
            x: (cx + p.x) * sx,
            y: (cy + p.y) * sy,
          }));

          pdf.setFillColor(fr, fg, fb);
          pdf.triangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, 'F');
          pdf.triangle(pts[0].x, pts[0].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y, 'F');
        }
      } else {
        // Linear gradient vector bands (masthead crimson/slate ribbon, FixedLogoBox backing)
        if (cs.backgroundImage && cs.backgroundImage.includes('linear-gradient(')) {
          const stops = parseGradientStops(cs.backgroundImage, bgUnderlay);
          if (stops.length >= 2) {
            const slices = 36;
            const sliceW = mmW / slices;
            for (let s = 0; s < slices; s++) {
              const [sr, sg, sb] = interpolateGradient(stops, (s + 0.5) / slices);
              pdf.setFillColor(sr, sg, sb);
              pdf.rect(mmX + s * sliceW, mmY, sliceW + 0.04, mmH, 'F');
            }
            nextBg = interpolateGradient(stops, 0.5);
          }
        } else {
          // Solid or translucent RGBA/OKLCH fill
          const bg = parseCssColor(cs.backgroundColor);
          if (bg) {
            const [fr, fg, fb] = blendOverPaper(bg, bgUnderlay);
            nextBg = [fr, fg, fb];
            pdf.setFillColor(fr, fg, fb);
            const br = parseFloat(cs.borderTopLeftRadius) || 0;
            if (br >= Math.min(r.width, r.height) / 2 - 0.5 && Math.abs(r.width - r.height) < 1.5) {
              const radMm = (vis.width / 2) * sx;
              pdf.circle(mmX + mmW / 2, mmY + mmH / 2, radMm, 'F');
            } else if (br > 0.5) {
              const radMm = Math.min(br * sx, mmW / 2, mmH / 2);
              pdf.roundedRect(mmX, mmY, mmW, mmH, radMm, radMm, 'F');
            } else {
              pdf.rect(mmX, mmY, mmW, mmH, 'F');
            }
          }
        }
      }

      // Draw crisp vector borders (including double-hairline rules)
      const drawBorderSide = (
        widthPx: number,
        colorStr: string,
        styleStr: string,
        side: 'top' | 'right' | 'bottom' | 'left'
      ) => {
        if (widthPx <= 0.05 || styleStr === 'none') return;
        const c = parseCssColor(colorStr);
        if (!c) return;
        const [br, bgC, bb] = blendOverPaper(c, bgUnderlay);
        pdf.setFillColor(br, bgC, bb);

        const drawStrip = (offsetPx: number, thicknessPx: number) => {
          if (side === 'top') {
            const y = r.top + offsetPx;
            if (y >= clip.top - 0.5 && y <= clip.bottom + 0.5) {
              pdf.rect(mmX, (y - elRect.top) * sy, mmW, thicknessPx * sy, 'F');
            }
          } else if (side === 'bottom') {
            const y = r.bottom - offsetPx - thicknessPx;
            if (y >= clip.top - 0.5 && y <= clip.bottom + 0.5) {
              pdf.rect(mmX, (y - elRect.top) * sy, mmW, thicknessPx * sy, 'F');
            }
          } else if (side === 'left') {
            const x = r.left + offsetPx;
            if (x >= clip.left - 0.5 && x <= clip.right + 0.5) {
              pdf.rect((x - elRect.left) * sx, mmY, thicknessPx * sx, mmH, 'F');
            }
          } else {
            const x = r.right - offsetPx - thicknessPx;
            if (x >= clip.left - 0.5 && x <= clip.right + 0.5) {
              pdf.rect((x - elRect.left) * sx, mmY, thicknessPx * sx, mmH, 'F');
            }
          }
        };

        if (styleStr === 'double' && widthPx >= 1.5) {
          const lineT = Math.max(0.6, widthPx * 0.32);
          drawStrip(0, lineT);
          drawStrip(widthPx - lineT, lineT);
        } else {
          drawStrip(0, widthPx);
        }
      };

      drawBorderSide(parseFloat(cs.borderTopWidth) || 0, cs.borderTopColor, cs.borderTopStyle, 'top');
      drawBorderSide(parseFloat(cs.borderRightWidth) || 0, cs.borderRightColor, cs.borderRightStyle, 'right');
      drawBorderSide(parseFloat(cs.borderBottomWidth) || 0, cs.borderBottomColor, cs.borderBottomStyle, 'bottom');
      drawBorderSide(parseFloat(cs.borderLeftWidth) || 0, cs.borderLeftColor, cs.borderLeftStyle, 'left');

      // Vector CSS multi-column rules (columns-2 / columns-3 vertical hairline dividers)
      const colCount = parseInt(cs.columnCount, 10);
      const colRuleW = parseFloat(cs.columnRuleWidth) || 0;
      if (!Number.isNaN(colCount) && colCount > 1 && colRuleW > 0 && cs.columnRuleStyle !== 'none') {
        const ruleCol = parseCssColor(cs.columnRuleColor);
        if (ruleCol) {
          const colGap = parseFloat(cs.columnGap) || 0;
          const colW = (r.width - colGap * (colCount - 1)) / colCount;
          const [rr, rg, rb] = blendOverPaper(ruleCol, bgUnderlay);
          pdf.setFillColor(rr, rg, rb);

          for (let cIdx = 1; cIdx < colCount; cIdx++) {
            const dividerLeft = r.left + cIdx * colW + (cIdx - 0.5) * colGap;
            // Only draw divider if text actually reached this column
            let maxColBottom = vis.top;
            for (const ch of Array.from(node.children)) {
              const rects = ch.getClientRects();
              for (let ri = 0; ri < rects.length; ri++) {
                const cr = rects[ri];
                if (cr.right > dividerLeft && cr.width > 1 && cr.height > 1) {
                  maxColBottom = Math.max(maxColBottom, cr.bottom);
                }
              }
            }
            const clampedBottom = Math.min(vis.bottom, maxColBottom);
            if (clampedBottom > vis.top + 4) {
              pdf.rect(
                (dividerLeft - elRect.left - colRuleW / 2) * sx,
                mmY,
                Math.max(0.15, colRuleW * sx),
                (clampedBottom - vis.top) * sy,
                'F'
              );
            }
          }
        }
      }
    }

    const clipsChildren = cs.overflowX === 'hidden' || cs.overflowY === 'hidden';
    const nextClip = clipsChildren ? vis : clip;
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i], nextClip, nextBg);
    }
  };

  walk(rootEl, elRect, [paperR, paperG, paperB]);
}

function toFullResCandidateUrl(src: string): string {
  if (!src) return src;
  if (!/(bp\.blogspot\.com|googleusercontent\.com)/i.test(src)) return src;
  return src
    .replace(/\/s\d+(-c)?\//, '/s0/')
    .replace(/\/w\d+-h\d+(-p-k-no-nu)?\//, '/s0/')
    .replace(/=s\d+(-c)?$/, '=s0');
}

async function fetchUrlAsImage(url: string): Promise<HTMLImageElement | null> {
  const loadFromSrc = (imgSrc: string, useCrossOrigin: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (useCrossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(() => resolve(img)).catch(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = imgSrc;
    });

  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    try {
      return await loadFromSrc(url, false);
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      try {
        return await loadFromSrc(objUrl, false);
      } catch {
        URL.revokeObjectURL(objUrl);
      }
    }
  } catch {
    // Fall through to CORS proxy
  }

  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      try {
        return await loadFromSrc(objUrl, false);
      } catch {
        URL.revokeObjectURL(objUrl);
      }
    }
  } catch {
    // Give up on this URL
  }

  return null;
}

async function resolveBestImage(
  src: string,
  cache: Map<string, HTMLImageElement | null>
): Promise<HTMLImageElement | null> {
  if (!src) return null;
  if (cache.has(src)) return cache.get(src) ?? null;

  const fullResUrl = toFullResCandidateUrl(src);
  let loaded: HTMLImageElement | null = null;
  if (fullResUrl !== src) {
    loaded = await fetchUrlAsImage(fullResUrl);
  }
  if (!loaded) {
    loaded = await fetchUrlAsImage(src);
  }

  cache.set(src, loaded);
  return loaded;
}

function getClippedRectForElement(target: Element, rootEl: HTMLElement, rootRect: CssRect): CssRect {
  let clip = { ...rootRect };
  const chain: Element[] = [];
  let cur: Element | null = target;
  while (cur && cur !== rootEl) {
    chain.push(cur);
    cur = cur.parentElement;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const el = chain[i];
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    if (i === 0 || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
      clip = intersectRect(clip, {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      });
    }
  }
  return clip;
}

/**
 * LAYER 2: Embeds every photograph and uploaded logo at its highest native pixel resolution
 * with exact centered object-fit: cover / contain math.
 */
async function drawHighResImagesToPdf(
  pdf: jsPDF,
  rootEl: HTMLElement,
  elRect: CssRect,
  sx: number,
  sy: number,
  imageCache: Map<string, HTMLImageElement | null>
): Promise<void> {
  const imgs = Array.from(rootEl.querySelectorAll('img'));
  for (const imgEl of imgs) {
    const src = imgEl.getAttribute('src') || '';
    if (!src) continue;

    const cs = window.getComputedStyle(imgEl);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0.01) {
      continue;
    }

    const vis = getClippedRectForElement(imgEl, rootEl, elRect);
    if (vis.width <= 1 || vis.height <= 1) continue;

    const loaded = await resolveBestImage(src, imageCache);
    if (!loaded || loaded.naturalWidth === 0 || loaded.naturalHeight === 0) continue;

    const natW = loaded.naturalWidth;
    const natH = loaded.naturalHeight;
    const objectFit = cs.objectFit || 'cover';

    const boxMmX = (vis.left - elRect.left) * sx;
    const boxMmY = (vis.top - elRect.top) * sy;
    const boxMmW = vis.width * sx;
    const boxMmH = vis.height * sy;

    const max600W = Math.max(64, Math.ceil((boxMmW / 25.4) * 600));
    const max600H = Math.max(64, Math.ceil((boxMmH / 25.4) * 600));

    if (objectFit === 'contain') {
      const boxAspect = boxMmW / boxMmH;
      const natAspect = natW / natH;
      let drawMmW = boxMmW;
      let drawMmH = boxMmH;
      if (natAspect > boxAspect) {
        drawMmH = boxMmW / natAspect;
      } else {
        drawMmW = boxMmH * natAspect;
      }
      const drawMmX = boxMmX + (boxMmW - drawMmW) / 2;
      const drawMmY = boxMmY + (boxMmH - drawMmH) / 2;

      const outW = Math.max(1, Math.min(natW, max600W));
      const outH = Math.max(1, Math.min(natH, max600H));
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(loaded, 0, 0, outW, outH);
        const pngData = canvas.toDataURL('image/png');
        pdf.addImage(pngData, 'PNG', drawMmX, drawMmY, drawMmW, drawMmH, undefined, 'FAST');
      }
      canvas.width = 0;
      canvas.height = 0;
    } else {
      const boxAspect = vis.width / vis.height;
      const natAspect = natW / natH;
      let cropX = 0;
      let cropY = 0;
      let cropW = natW;
      let cropH = natH;
      if (natAspect > boxAspect) {
        cropW = natH * boxAspect;
        cropX = (natW - cropW) / 2;
      } else {
        cropH = natW / boxAspect;
        cropY = (natH - cropH) / 2;
      }

      const outW = Math.max(1, Math.min(Math.round(cropW), max600W));
      const outH = Math.max(1, Math.min(Math.round(cropH), max600H));
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(loaded, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
        const jpgData = canvas.toDataURL('image/jpeg', 0.96);
        pdf.addImage(jpgData, 'JPEG', boxMmX, boxMmY, boxMmW, boxMmH, undefined, 'FAST');
      }
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

// ---------- PURE VECTOR TEXT ENGINE (fontkit OpenType Shaping -> PDF Bezier Outlines) ----------

function parseUnicodeRanges(rangeStr: string): Array<[number, number]> {
  if (!rangeStr) return [[0, 0x10ffff]];
  const ranges: Array<[number, number]> = [];
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const clean = part.trim().replace(/^U\+/i, '');
    if (!clean) continue;
    if (clean.includes('?')) {
      const start = parseInt(clean.replace(/\?/g, '0'), 16);
      const end = parseInt(clean.replace(/\?/g, 'F'), 16);
      if (!Number.isNaN(start) && !Number.isNaN(end)) ranges.push([start, end]);
    } else if (clean.includes('-')) {
      const [a, b] = clean.split('-');
      const start = parseInt(a, 16);
      const end = parseInt(b, 16);
      if (!Number.isNaN(start) && !Number.isNaN(end)) ranges.push([start, end]);
    } else {
      const val = parseInt(clean, 16);
      if (!Number.isNaN(val)) ranges.push([val, val]);
    }
  }
  return ranges.length > 0 ? ranges : [[0, 0x10ffff]];
}

function parseFontWeightRange(weightStr: string): [number, number] {
  const nums = (weightStr || '400').trim().split(/\s+/).map((w) => {
    if (w === 'bold') return 700;
    if (w === 'normal') return 400;
    return parseInt(w, 10) || 400;
  });
  return nums.length >= 2 ? [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])] : [nums[0], nums[0]];
}

function parseFontFacesFromCssText(cssText: string): FontFaceEntry[] {
  const entries: FontFaceEntry[] = [];
  const blocks = cssText.match(/@font-face\s*\{[^}]+\}/gi) || [];
  for (const block of blocks) {
    const famMatch = block.match(/font-family\s*:\s*(['"]?)([^;'"]+)\1/i);
    const styleMatch = block.match(/font-style\s*:\s*([^;]+)/i);
    const weightMatch = block.match(/font-weight\s*:\s*([^;]+)/i);
    const rangeMatch = block.match(/unicode-range\s*:\s*([^;]+)/i);
    const srcMatch = block.match(/src\s*:[^;]*url\((['"]?)([^)'"]+)\1\)/i);
    if (!famMatch || !srcMatch) continue;
    const [weightMin, weightMax] = parseFontWeightRange(weightMatch?.[1] || '400');
    entries.push({
      family: famMatch[2].trim().toLowerCase(),
      style: (styleMatch?.[1] || 'normal').trim().toLowerCase(),
      weightMin,
      weightMax,
      ranges: parseUnicodeRanges(rangeMatch?.[1] || ''),
      url: srcMatch[2].trim(),
    });
  }
  return entries;
}

class VectorFontRegistry {
  private faces: FontFaceEntry[] = [];
  private baseFontCache = new Map<string, Promise<FontkitFont | null>>();
  private variedFontCache = new Map<string, FontkitFont>();
  private glyphPathCache = new Map<string, VectorPathCmd[]>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const collected: FontFaceEntry[] = [];
    const unreadableLinks: string[] = [];

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (rules) {
          for (const rule of Array.from(rules)) {
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              collected.push(...parseFontFacesFromCssText(rule.cssText));
            }
          }
        }
      } catch {
        if (sheet.href) unreadableLinks.push(sheet.href);
      }
    }

    // Fallback: fetch any stylesheet link directly if CSSStyleSheet blocked reading cssRules
    if (collected.length === 0 || unreadableLinks.length > 0) {
      const linkUrls = new Set<string>(unreadableLinks);
      if (collected.length === 0) {
        document.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
          const href = (lnk as HTMLLinkElement).href;
          if (href) linkUrls.add(href);
        });
      }
      await Promise.all(
        Array.from(linkUrls).map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const txt = await res.text();
              collected.push(...parseFontFacesFromCssText(txt));
            }
          } catch {
            // ignore inaccessible external css
          }
        })
      );
    }

    this.faces = collected;
  }

  hasFaces(): boolean {
    return this.faces.length > 0;
  }

  private async loadBaseFont(url: string): Promise<FontkitFont | null> {
    if (this.baseFontCache.has(url)) return this.baseFontCache.get(url)!;
    const p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = new Uint8Array(await res.arrayBuffer());
        const created = fontkit.create(buf as unknown as Buffer);
        if ('fonts' in created && Array.isArray(created.fonts)) {
          return created.fonts[0] ?? null;
        }
        return created as FontkitFont;
      } catch {
        return null;
      }
    })();
    this.baseFontCache.set(url, p);
    return p;
  }

  private faceCoversCodePoint(face: FontFaceEntry, cp: number): boolean {
    for (const [lo, hi] of face.ranges) {
      if (cp >= lo && cp <= hi) return true;
    }
    return false;
  }

  private getVariedFont(base: FontkitFont, faceUrl: string, targetWeight: number): FontkitFont {
    const key = `${faceUrl}::${targetWeight}`;
    const existing = this.variedFontCache.get(key);
    if (existing) return existing;

    let instance = base;
    try {
      const wghtAxis = base.variationAxes?.wght;
      if (wghtAxis) {
        const clamped = Math.min(wghtAxis.max, Math.max(wghtAxis.min, targetWeight));
        instance = base.getVariation({ wght: clamped });
      }
    } catch {
      instance = base;
    }
    this.variedFontCache.set(key, instance);
    return instance;
  }

  async resolveFontForCodePoint(
    cp: number,
    fontFamilyCss: string,
    weight: number,
    style: string
  ): Promise<{ font: FontkitFont; cacheKey: string } | null> {
    const families = fontFamilyCss
      .split(',')
      .map((f) => f.trim().replace(/["']/g, '').toLowerCase())
      .filter((f) => f && f !== 'serif' && f !== 'sans-serif' && f !== 'monospace' && f !== 'system-ui');

    // Add default broadsheet fallbacks at the end of family search
    for (const fb of ['noto serif bengali', 'tiro bangla', 'hind siliguri', 'plus jakarta sans']) {
      if (!families.includes(fb)) families.push(fb);
    }

    const normStyle = style === 'italic' ? 'italic' : 'normal';

    for (const fam of families) {
      const famFaces = this.faces.filter((f) => f.family === fam && this.faceCoversCodePoint(f, cp));
      if (famFaces.length === 0) continue;

      // Sort by matching style first, then closest weight distance
      famFaces.sort((a, b) => {
        const aStyleScore = a.style === normStyle ? 0 : 1;
        const bStyleScore = b.style === normStyle ? 0 : 1;
        if (aStyleScore !== bStyleScore) return aStyleScore - bStyleScore;
        const aDist =
          weight >= a.weightMin && weight <= a.weightMax
            ? 0
            : Math.min(Math.abs(weight - a.weightMin), Math.abs(weight - a.weightMax));
        const bDist =
          weight >= b.weightMin && weight <= b.weightMax
            ? 0
            : Math.min(Math.abs(weight - b.weightMin), Math.abs(weight - b.weightMax));
        return aDist - bDist;
      });

      for (const candidate of famFaces) {
        const base = await this.loadBaseFont(candidate.url);
        if (!base) continue;
        if (!base.hasGlyphForCodePoint(cp)) continue;
        const varied = this.getVariedFont(base, candidate.url, weight);
        return {
          font: varied,
          cacheKey: `${candidate.url}::${weight}`,
        };
      }
    }

    return null;
  }

  getNormalizedGlyphCommands(fontCacheKey: string, glyph: Glyph): VectorPathCmd[] {
    const key = `${fontCacheKey}#${glyph.id}`;
    const cached = this.glyphPathCache.get(key);
    if (cached) return cached;

    const cmds: VectorPathCmd[] = [];
    let cx = 0;
    let cy = 0;

    for (const raw of glyph.path.commands) {
      if (raw.command === 'moveTo') {
        const [x, y] = raw.args;
        cmds.push({ op: 'm', args: [x, y] });
        cx = x;
        cy = y;
      } else if (raw.command === 'lineTo') {
        const [x, y] = raw.args;
        cmds.push({ op: 'l', args: [x, y] });
        cx = x;
        cy = y;
      } else if (raw.command === 'quadraticCurveTo') {
        const [qx, qy, x, y] = raw.args;
        const c1x = cx + (2 / 3) * (qx - cx);
        const c1y = cy + (2 / 3) * (qy - cy);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);
        cmds.push({ op: 'c', args: [c1x, c1y, c2x, c2y, x, y] });
        cx = x;
        cy = y;
      } else if (raw.command === 'bezierCurveTo') {
        const [x1, y1, x2, y2, x, y] = raw.args;
        cmds.push({ op: 'c', args: [x1, y1, x2, y2, x, y] });
        cx = x;
        cy = y;
      } else if (raw.command === 'closePath') {
        cmds.push({ op: 'h' });
      }
    }

    this.glyphPathCache.set(key, cmds);
    return cmds;
  }
}

function drawGlyphVector(
  pdf: jsPDF,
  cmds: VectorPathCmd[],
  gx: number,
  gy: number,
  scale: number
): void {
  if (cmds.length === 0) return;
  let hasMove = false;
  for (const cmd of cmds) {
    if (cmd.op === 'm') {
      pdf.moveTo(gx + cmd.args[0] * scale, gy - cmd.args[1] * scale);
      hasMove = true;
    } else if (cmd.op === 'l') {
      pdf.lineTo(gx + cmd.args[0] * scale, gy - cmd.args[1] * scale);
    } else if (cmd.op === 'c') {
      const [x1, y1, x2, y2, x, y] = cmd.args;
      pdf.curveTo(
        gx + x1 * scale,
        gy - y1 * scale,
        gx + x2 * scale,
        gy - y2 * scale,
        gx + x * scale,
        gy - y * scale
      );
    } else if (cmd.op === 'h') {
      pdf.close();
    }
  }
  if (hasMove) pdf.fill();
}

function drawVectorSymbolFallback(
  pdf: jsPDF,
  ch: string,
  penX: number,
  baselineMm: number,
  fontSizeMm: number
): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp === 0x25cf) {
    // ● Bullet dot
    pdf.circle(penX + fontSizeMm * 0.35, baselineMm - fontSizeMm * 0.3, fontSizeMm * 0.25, 'F');
    return fontSizeMm * 0.78;
  }
  if (cp === 0x25b8) {
    // ▸ Continuation triangle
    pdf.triangle(
      penX + fontSizeMm * 0.08,
      baselineMm - fontSizeMm * 0.56,
      penX + fontSizeMm * 0.08,
      baselineMm - fontSizeMm * 0.04,
      penX + fontSizeMm * 0.58,
      baselineMm - fontSizeMm * 0.3,
      'F'
    );
    return fontSizeMm * 0.72;
  }
  if (cp === 0x00b7 || cp === 0x2022) {
    // · / • Middle dot
    pdf.circle(penX + fontSizeMm * 0.2, baselineMm - fontSizeMm * 0.28, fontSizeMm * 0.09, 'F');
    return fontSizeMm * 0.42;
  }
  return fontSizeMm * 0.35;
}

/**
 * Splits a single DOM word into maximal contiguous runs that belong to the same font
 * (preserving complete Bengali conjunct words intact while cleanly handling mixed English/punctuation).
 */
async function splitWordIntoFontRuns(
  word: string,
  registry: VectorFontRegistry,
  fontFamily: string,
  fontWeight: number,
  fontStyle: string
): Promise<Array<{ text: string; font: FontkitFont | null; cacheKey: string }>> {
  const chars = Array.from(word);
  const runs: Array<{ text: string; font: FontkitFont | null; cacheKey: string }> = [];

  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    // Zero-width joiners/non-joiners stick to the active Bengali run so ligatures never split
    if (cp === 0x200c || cp === 0x200d) {
      if (runs.length > 0) {
        runs[runs.length - 1].text += ch;
        continue;
      }
    }

    const resolved = await registry.resolveFontForCodePoint(cp, fontFamily, fontWeight, fontStyle);
    const cacheKey = resolved ? resolved.cacheKey : '__fallback__';
    if (runs.length > 0 && runs[runs.length - 1].cacheKey === cacheKey) {
      runs[runs.length - 1].text += ch;
    } else {
      runs.push({
        text: ch,
        font: resolved?.font ?? null,
        cacheKey,
      });
    }
  }

  return runs;
}

/**
 * Renders EVERY word in the newspaper page using exact Chrome DOM Range layout coordinates
 * (multi-column, float, justify, line-clamp, letter-spacing) + fontkit OpenType Bengali/English shaping
 * into 100% pure infinite-zoom PDF vector glyph curves.
 */
async function drawDomVectorTextToPdf(
  pdf: jsPDF,
  rootEl: HTMLElement,
  elRect: CssRect,
  sx: number,
  sy: number,
  registry: VectorFontRegistry
): Promise<void> {
  const range = document.createRange();
  let lastColorKey = '';

  const textEntries: Array<{ node: Text; parent: Element; clip: CssRect }> = [];

  const collectText = (node: Node, clip: CssRect) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.nodeValue || '';
      if (txt.trim().length > 0 && node.parentElement) {
        textEntries.push({ node: node as Text, parent: node.parentElement, clip });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (tag === 'SVG' || tag === 'IMG' || tag === 'STYLE' || tag === 'SCRIPT') return;

    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0.01) {
      return;
    }

    const r = el.getBoundingClientRect();
    const vis = intersectRect(
      { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
      clip
    );
    if (vis.width <= 0.05 || vis.height <= 0.05) return;

    const nextClip =
      cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.webkitLineClamp !== 'none'
        ? vis
        : clip;

    for (let i = 0; i < el.childNodes.length; i++) {
      collectText(el.childNodes[i], nextClip);
    }
  };

  collectText(rootEl, elRect);

  for (const { node, parent, clip } of textEntries) {
    const rawText = node.nodeValue || '';
    const cs = window.getComputedStyle(parent);
    const parsedColor = parseCssColor(cs.color);
    if (!parsedColor) continue;

    const [cr, cg, cb] = blendOverPaper(parsedColor);
    const colorKey = `${cr},${cg},${cb}`;
    if (colorKey !== lastColorKey) {
      pdf.setFillColor(cr, cg, cb);
      lastColorKey = colorKey;
    }

    const fontSizePx = parseFloat(cs.fontSize) || 12;
    const fontSizeMm = fontSizePx * sy;
    const fontFamily = cs.fontFamily || 'Noto Serif Bengali';
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const fontStyle = cs.fontStyle || 'normal';
    const letterSpacingPx = parseFloat(cs.letterSpacing) || 0;
    const textTransform = cs.textTransform || 'none';

    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(rawText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      range.setStart(node, start);
      range.setEnd(node, end);

      const rects = range.getClientRects();
      if (rects.length === 0) continue;

      // Handle both standard 1-rect words and rare mid-word wraps across lines
      const pieces: Array<{ text: string; rect: DOMRect }> = [];
      if (rects.length === 1) {
        pieces.push({ text: match[0], rect: rects[0] });
      } else {
        // Measure char-by-char when a single token wrapped across two lines
        let curLineTop = rects[0].top;
        let lineStart = start;
        let lineRect = rects[0];
        for (let ci = start; ci < end; ci++) {
          range.setStart(node, ci);
          range.setEnd(node, ci + 1);
          const cr = range.getClientRects()[0];
          if (!cr) continue;
          if (Math.abs(cr.top - curLineTop) > 2 && ci > lineStart) {
            range.setStart(node, lineStart);
            range.setEnd(node, ci);
            const segRect = range.getClientRects()[0] || lineRect;
            pieces.push({ text: rawText.slice(lineStart, ci), rect: segRect });
            lineStart = ci;
            curLineTop = cr.top;
            lineRect = cr;
          }
        }
        range.setStart(node, lineStart);
        range.setEnd(node, end);
        const lastRect = range.getClientRects()[0] || lineRect;
        pieces.push({ text: rawText.slice(lineStart, end), rect: lastRect });
      }

      for (const piece of pieces) {
        const wr = piece.rect;
        if (wr.width <= 0.1 || wr.height <= 0.1) continue;
        // Enforce ancestor overflow:hidden / line-clamp clipping strictly
        const midX = (wr.left + wr.right) / 2;
        const midY = (wr.top + wr.bottom) / 2;
        if (
          midX < clip.left ||
          midX > clip.right ||
          midY < clip.top ||
          midY > clip.bottom
        ) {
          continue;
        }

        let displayWord = piece.text;
        if (textTransform === 'uppercase') displayWord = displayWord.toUpperCase();
        else if (textTransform === 'lowercase') displayWord = displayWord.toLowerCase();

        const runs = await splitWordIntoFontRuns(
          displayWord,
          registry,
          fontFamily,
          fontWeight,
          fontStyle
        );

        // Determine accurate baseline from primary loaded font metrics
        const primaryFont = runs.find((r) => r.font)?.font ?? null;
        const ascentRatio = primaryFont
          ? primaryFont.ascent / Math.max(1, primaryFont.ascent - primaryFont.descent)
          : 0.78;
        const baselineMm = (wr.top - elRect.top + wr.height * ascentRatio) * sy;

        // Pre-layout runs to match exact CSS tracking / letter-spacing if applied (e.g. masthead tracking-[0.22em])
        const shapedRuns = runs.map((run) => {
          if (!run.font) {
            return { ...run, glyphRun: null as ReturnType<FontkitFont['layout']> | null, naturalMm: fontSizeMm * 0.5 * run.text.length };
          }
          const glyphRun = run.font.layout(run.text);
          const scale = fontSizeMm / run.font.unitsPerEm;
          return {
            ...run,
            glyphRun,
            naturalMm: glyphRun.advanceWidth * scale,
          };
        });

        const totalNaturalMm = shapedRuns.reduce((acc, sr) => acc + sr.naturalMm, 0);
        const domWidthMm = wr.width * sx;
        const spacingGlyphs = shapedRuns.reduce(
          (acc, sr) =>
            acc +
            (sr.glyphRun
              ? sr.glyphRun.positions.filter((p) => p.xAdvance > 0).length
              : sr.text.length),
          0
        );
        const extraTrackPerGlyphMm =
          letterSpacingPx > 0.4 && spacingGlyphs > 1 && domWidthMm > totalNaturalMm + 0.05
            ? (domWidthMm - totalNaturalMm) / (spacingGlyphs - 1)
            : 0;

        let penX = (wr.left - elRect.left) * sx;
        for (const sr of shapedRuns) {
          if (!sr.font || !sr.glyphRun) {
            for (const ch of Array.from(sr.text)) {
              penX += drawVectorSymbolFallback(pdf, ch, penX, baselineMm, fontSizeMm) + extraTrackPerGlyphMm;
            }
            continue;
          }

          const scale = fontSizeMm / sr.font.unitsPerEm;
          for (let gi = 0; gi < sr.glyphRun.glyphs.length; gi++) {
            const g = sr.glyphRun.glyphs[gi];
            const pos = sr.glyphRun.positions[gi];
            const gx = penX + pos.xOffset * scale;
            const gy = baselineMm - pos.yOffset * scale;

            if (g.id === 0) {
              const cp = g.codePoints?.[0];
              const ch = cp ? String.fromCodePoint(cp) : '';
              if (ch) drawVectorSymbolFallback(pdf, ch, gx, baselineMm, fontSizeMm);
            } else {
              const cmds = registry.getNormalizedGlyphCommands(sr.cacheKey, g);
              drawGlyphVector(pdf, cmds, gx, gy, scale);
            }

            penX += pos.xAdvance * scale + (pos.xAdvance > 0 ? extraTrackPerGlyphMm : 0);
          }
        }
      }
    }
  }
}

// ---------- EMERGENCY OFFLINE FALLBACK ONLY (IF ZERO WEBFONTS LOADED) ----------

function loadSvgBlobImage(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const done = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      if (typeof img.decode === 'function') img.decode().then(done).catch(done);
      else done();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function drawFallback600DpiTextStripsToPdf(
  pdf: jsPDF,
  el: HTMLElement,
  elWidth: number,
  elHeight: number,
  mmWidth: number,
  mmHeight: number,
  fontEmbedCss: string
): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'));
  const savedSrcs: Array<{ img: HTMLImageElement; src: string }> = [];
  for (const img of imgs) {
    savedSrcs.push({ img, src: img.getAttribute('src') || '' });
    img.setAttribute('src', TRANSPARENT_1X1_PNG);
  }

  let dataSvgUrl = '';
  try {
    dataSvgUrl = await toSvg(el, { fontEmbedCSS: fontEmbedCss, cacheBust: true });
  } finally {
    for (const { img, src } of savedSrcs) {
      if (src) img.setAttribute('src', src);
      else img.removeAttribute('src');
    }
  }

  const prefix = 'data:image/svg+xml;charset=utf-8,';
  const rawSvg = dataSvgUrl.startsWith(prefix)
    ? decodeURIComponent(dataSvgUrl.slice(prefix.length))
    : dataSvgUrl;

  const svgDoc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  const clonedSheet = svgDoc.querySelector('foreignObject')?.firstElementChild as HTMLElement | null;
  if (!clonedSheet) return;

  clonedSheet.style.position = 'relative';
  clonedSheet.style.left = '0';
  clonedSheet.style.top = '0';
  clonedSheet.style.transform = 'none';
  clonedSheet.style.margin = '0';

  const embeddedCss = Array.from(clonedSheet.querySelectorAll('style'))
    .map((s) => {
      const txt = s.textContent || '';
      s.remove();
      return txt;
    })
    .join('\n');

  const overrideCss = `
    ${embeddedCss || fontEmbedCss}
    .dhara-pdf-strip-root,
    .dhara-pdf-strip-root *:not(svg):not(svg *) {
      background-color: transparent !important;
      background-image: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
    .dhara-pdf-strip-root img { opacity: 0 !important; visibility: hidden !important; }
  `;

  const TARGET_DPI = 600;
  const targetPageW = Math.round((mmWidth / 25.4) * TARGET_DPI);
  const targetPageH = Math.round((mmHeight / 25.4) * TARGET_DPI);
  const stripCount = Math.max(8, Math.ceil((targetPageW * targetPageH) / 7_500_000));

  const svgNs = 'http://www.w3.org/2000/svg';
  const xhtmlNs = 'http://www.w3.org/1999/xhtml';
  const serializer = new XMLSerializer();

  const stripSvgEl = document.createElementNS(svgNs, 'svg');
  stripSvgEl.setAttribute('xmlns', svgNs);
  stripSvgEl.setAttribute('width', String(targetPageW));
  const stripFo = document.createElementNS(svgNs, 'foreignObject');
  stripFo.setAttribute('x', '0');
  stripFo.setAttribute('y', '0');
  stripFo.setAttribute('width', String(elWidth));

  const stripRoot = document.createElementNS(xhtmlNs, 'div') as HTMLDivElement;
  stripRoot.setAttribute('class', 'dhara-pdf-strip-root');
  const styleEl = document.createElementNS(xhtmlNs, 'style');
  styleEl.textContent = overrideCss;
  const translateWrap = document.createElementNS(xhtmlNs, 'div') as HTMLDivElement;
  translateWrap.appendChild(document.importNode(clonedSheet, true));

  stripRoot.appendChild(styleEl);
  stripRoot.appendChild(translateWrap);
  stripFo.appendChild(stripRoot);
  stripSvgEl.appendChild(stripFo);

  for (let s = 0; s < stripCount; s++) {
    const y0 = Math.round((s * elHeight) / stripCount);
    const y1 = Math.round(((s + 1) * elHeight) / stripCount);
    const bandCssH = Math.max(1, y1 - y0);
    const bandPxH = Math.max(1, Math.round((bandCssH / elHeight) * targetPageH));
    const bandMmY = (y0 / elHeight) * mmHeight;
    const bandMmH = (bandCssH / elHeight) * mmHeight;

    stripSvgEl.setAttribute('height', String(bandPxH));
    stripSvgEl.setAttribute('viewBox', `0 0 ${elWidth} ${bandCssH}`);
    stripFo.setAttribute('height', String(bandCssH));
    stripRoot.setAttribute(
      'style',
      `width:${elWidth}px;height:${bandCssH}px;overflow:hidden;position:relative;`
    );
    translateWrap.setAttribute(
      'style',
      `width:${elWidth}px;height:${elHeight}px;transform:translateY(-${y0}px);transform-origin:top left;`
    );

    const stripImg = await loadSvgBlobImage(serializer.serializeToString(stripSvgEl));
    const canvas = document.createElement('canvas');
    canvas.width = targetPageW;
    canvas.height = bandPxH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, targetPageW, bandPxH);
      ctx.drawImage(stripImg, 0, 0, targetPageW, bandPxH);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, bandMmY, mmWidth, bandMmH, undefined, 'FAST');
    }
    canvas.width = 0;
    canvas.height = 0;
  }
}

const sharedFontRegistry = new VectorFontRegistry();

export async function exportPagesToPrintPdf(options: {
  pageElements: HTMLElement[];
  format: PaperFormat;
  orientation: PaperOrientation;
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { pageElements, format, orientation, fileName, onProgress } = options;
  if (pageElements.length === 0) {
    throw new Error('No newspaper pages selected for export.');
  }

  const mm = PAPER_MM[format][orientation];
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [mm.width, mm.height],
    compress: true,
  });

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  await sharedFontRegistry.init();
  const useVectorText = sharedFontRegistry.hasFaces();

  let fallbackFontCss = '';
  if (!useVectorText) {
    try {
      fallbackFontCss = await getFontEmbedCSS(pageElements[0], { cacheBust: true });
    } catch {
      fallbackFontCss = '';
    }
  }

  const imageCache = new Map<string, HTMLImageElement | null>();

  try {
    for (let i = 0; i < pageElements.length; i++) {
      onProgress?.(i + 1, pageElements.length);
      const el = pageElements[i];

      if (i > 0) {
        pdf.addPage([mm.width, mm.height], orientation);
      }

      const r = el.getBoundingClientRect();
      const elRect: CssRect = {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width || el.offsetWidth,
        height: r.height || el.offsetHeight,
      };
      const sx = mm.width / elRect.width;
      const sy = mm.height / elRect.height;

      // Layer 1: Pure vector paper, boxes, ribbons, column rules, double borders & inline SVG emblems
      drawDomVectorsToPdf(pdf, el, elRect, sx, sy, mm.width, mm.height);

      // Layer 2: Full original-resolution photographs & uploaded custom logos
      await drawHighResImagesToPdf(pdf, el, elRect, sx, sy, imageCache);

      // Layer 3: True infinite-zoom vector Bengali & English text via fontkit OpenType shaping
      if (useVectorText) {
        await drawDomVectorTextToPdf(pdf, el, elRect, sx, sy, sharedFontRegistry);
      } else {
        await drawFallback600DpiTextStripsToPdf(
          pdf,
          el,
          elRect.width,
          elRect.height,
          mm.width,
          mm.height,
          fallbackFontCss
        );
      }
    }

    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } finally {
    imageCache.forEach((img) => {
      if (img && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
    });
    imageCache.clear();
  }
}

/**
 * Injects an exact @page print rule & proportional CSS transform scale matching the selected
 * A3/A4 format & orientation, invoking true 1:1 native vector print / browser Save-as-PDF.
 */
export function triggerNativeVectorPrint(format: PaperFormat, orientation: PaperOrientation): void {
  const styleId = 'dhara-dynamic-print-page-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const mm = PAPER_MM[format][orientation];
  const dims = getCanvasDimensions(format, orientation);
  const mmWidthInCssPx = mm.width * (96 / 25.4);
  const printScale = mmWidthInCssPx / dims.width;

  styleEl.textContent = `
    @page {
      size: ${mm.width}mm ${mm.height}mm;
      margin: 0;
    }
    @media print {
      .print-only-container > div {
        width: ${mm.width}mm !important;
        height: ${mm.height}mm !important;
        overflow: hidden !important;
        page-break-after: always;
        break-after: page;
      }
      .print-only-container > div:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .print-only-container .print-page-break {
        width: ${dims.width}px !important;
        height: ${dims.height}px !important;
        transform: scale(${printScale.toFixed(6)}) !important;
        transform-origin: top left !important;
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  `;

  window.print();
}
