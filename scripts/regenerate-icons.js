const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const outDir = path.join(__dirname, '..', 'assets');

const COLORS = {
  bg: [20, 24, 31, 255],
  ivory: [250, 247, 240, 255],
  sand: [224, 177, 108, 255],
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function alphaOver(dst, src) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    return [0, 0, 0, 0];
  }
  return [
    Math.round((src[0] * sa + dst[0] * da * (1 - sa)) / outA),
    Math.round((src[1] * sa + dst[1] * da * (1 - sa)) / outA),
    Math.round((src[2] * sa + dst[2] * da * (1 - sa)) / outA),
    Math.round(outA * 255),
  ];
}

function fillPixel(png, x, y, rgba) {
  const index = (png.width * y + x) << 2;
  png.data[index] = rgba[0];
  png.data[index + 1] = rgba[1];
  png.data[index + 2] = rgba[2];
  png.data[index + 3] = rgba[3];
}

function sdRoundedRect(x, y, hx, hy, radius) {
  const qx = Math.abs(x) - hx + radius;
  const qy = Math.abs(y) - hy + radius;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby || 1;
  const t = clamp01((apx * abx + apy * aby) / len2);
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  return Math.hypot(px - qx, py - qy);
}

function angleInArc(theta, start, end) {
  const tau = Math.PI * 2;
  let t = theta % tau;
  if (t < 0) t += tau;
  let s = start % tau;
  if (s < 0) s += tau;
  let e = end % tau;
  if (e < 0) e += tau;
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e;
}

function drawSymbolPixel(nx, ny, scale = 0.84) {
  const x = nx / scale;
  const y = ny / scale;
  const aa = 0.008;
  const dist = Math.hypot(x, y);
  const theta = Math.atan2(y, x);

  const rOuter = 0.7;
  const rInner = 0.53;
  const radiusMid = (rOuter + rInner) / 2;
  const ringHalf = (rOuter - rInner) / 2;

  let pixel = [0, 0, 0, 0];

  const ringAlpha =
    1 - smoothstep(ringHalf - aa, ringHalf + aa, Math.abs(dist - radiusMid));
  if (ringAlpha > 0) {
    const topGap = angleInArc(theta, -1.64, -1.42);
    const rightGap = angleInArc(theta, -0.14, 0.16);
    const accentArc = angleInArc(theta, -1.08, -0.14);
    const ivoryArc = !topGap && !rightGap && !accentArc;

    if (ivoryArc) {
      pixel = alphaOver(pixel, [
        COLORS.ivory[0],
        COLORS.ivory[1],
        COLORS.ivory[2],
        Math.round(ringAlpha * 255),
      ]);
    }
    if (accentArc) {
      pixel = alphaOver(pixel, [
        COLORS.sand[0],
        COLORS.sand[1],
        COLORS.sand[2],
        Math.round(ringAlpha * 255),
      ]);
    }
  }

  const stroke = 0.095;
  const d1 = distToSegment(x, y, -0.23, 0.03, -0.02, 0.24);
  const d2 = distToSegment(x, y, -0.02, 0.24, 0.3, -0.08);
  const checkAlpha = Math.max(
    1 - smoothstep(stroke - aa, stroke + aa, d1),
    1 - smoothstep(stroke - aa, stroke + aa, d2)
  );
  if (checkAlpha > 0) {
    pixel = alphaOver(pixel, [
      COLORS.ivory[0],
      COLORS.ivory[1],
      COLORS.ivory[2],
      Math.round(checkAlpha * 255),
    ]);
  }

  return pixel;
}

function writePng(filePath, width, height, pixelFn) {
  const png = new PNG({ width, height });
  const samples = 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const fx = ((x + (sx + 0.5) / samples) / width) * 2 - 1;
          const fy = ((y + (sy + 0.5) / samples) / height) * 2 - 1;
          const rgba = pixelFn(fx, fy);
          r += rgba[0];
          g += rgba[1];
          b += rgba[2];
          a += rgba[3];
        }
      }
      const count = samples * samples;
      fillPixel(png, x, y, [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count),
        Math.round(a / count),
      ]);
    }
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function makeIconPixelFn({ rounded, symbolScale }) {
  return (x, y) => {
    let pixel = [0, 0, 0, 0];
    if (rounded) {
      const bgAlpha = 1 - smoothstep(-0.002, 0.006, sdRoundedRect(x, y, 0.86, 0.86, 0.2));
      if (bgAlpha > 0) {
        pixel = alphaOver(pixel, [
          COLORS.bg[0],
          COLORS.bg[1],
          COLORS.bg[2],
          Math.round(bgAlpha * 255),
        ]);
      }
    } else {
      pixel = [COLORS.bg[0], COLORS.bg[1], COLORS.bg[2], COLORS.bg[3]];
    }
    pixel = alphaOver(pixel, drawSymbolPixel(x, y, symbolScale));
    return pixel;
  };
}

function makeSplashPixelFn() {
  return (x, y) => {
    let pixel = [COLORS.bg[0], COLORS.bg[1], COLORS.bg[2], COLORS.bg[3]];

    const symbol = drawSymbolPixel(x, y, 0.56);
    pixel = alphaOver(pixel, symbol);

    const pill = sdRoundedRect(x, y - 0.62, 0.08, 0.01, 0.01);
    const pillAlpha = 1 - smoothstep(-0.002, 0.006, pill);
    if (pillAlpha > 0) {
      pixel = alphaOver(pixel, [
        COLORS.sand[0],
        COLORS.sand[1],
        COLORS.sand[2],
        Math.round(pillAlpha * 255),
      ]);
    }

    return pixel;
  };
}

writePng(path.join(outDir, 'icon.png'), 1024, 1024, makeIconPixelFn({ rounded: true, symbolScale: 0.82 }));
writePng(path.join(outDir, 'splash-icon.png'), 1024, 1024, makeSplashPixelFn());
writePng(path.join(outDir, 'favicon.png'), 48, 48, makeIconPixelFn({ rounded: true, symbolScale: 0.84 }));
writePng(path.join(outDir, 'adaptive-icon.png'), 1024, 1024, makeIconPixelFn({ rounded: true, symbolScale: 0.82 }));
writePng(path.join(outDir, 'adaptive-icon-foreground.png'), 1254, 1254, (x, y) =>
  drawSymbolPixel(x, y, 0.84)
);

console.log('Launcher assets regenerated.');
