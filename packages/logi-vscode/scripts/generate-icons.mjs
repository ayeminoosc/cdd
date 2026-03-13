import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const rootDir = path.resolve(process.cwd());
const iconsDir = path.join(rootDir, 'icons');

fs.mkdirSync(iconsDir, { recursive: true });

const themePalette = {
  backgroundA: [6, 15, 30, 255],
  backgroundB: [15, 31, 61, 255],
  border: [110, 231, 249, 120],
  cyan: [110, 231, 249, 255],
  coral: [255, 120, 96, 255],
  gold: [255, 211, 107, 255],
  violet: [167, 139, 250, 255],
  white: [244, 247, 251, 255],
  shadow: [0, 0, 0, 90]
};

function generateIcon(filePath, size, options) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 128;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      if (options.transparent) {
        pixels[index + 3] = 0;
        continue;
      }

      const vertical = y / (size - 1 || 1);
      const horizontal = x / (size - 1 || 1);
      const vignette = Math.max(0, 1 - distance(x, y, size * 0.52, size * 0.44) / (size * 0.82));
      const mixValue = clamp01(vertical * 0.68 + horizontal * 0.18 + (1 - vignette) * 0.14);
      const base = mix(themePalette.backgroundA, themePalette.backgroundB, mixValue);
      writePixel(pixels, index, base);
    }
  }

  fillRoundedRect(pixels, size, 10 * scale, 10 * scale, size - 20 * scale, size - 20 * scale, 26 * scale, [9, 19, 37, 255]);
  strokeRoundedRect(pixels, size, 10 * scale, 10 * scale, size - 20 * scale, size - 20 * scale, 26 * scale, Math.max(1, Math.round(2 * scale)), themePalette.border);

  fillCircle(pixels, size, 96 * scale, 28 * scale, 12 * scale, [255, 211, 107, 170]);
  fillCircle(pixels, size, 32 * scale, 100 * scale, 26 * scale, [110, 231, 249, 40]);
  fillCircle(pixels, size, 86 * scale, 88 * scale, 30 * scale, [167, 139, 250, 30]);

  fillRoundedRect(pixels, size, 34 * scale, 28 * scale, 16 * scale, 70 * scale, 8 * scale, themePalette.cyan);
  fillRoundedRect(pixels, size, 34 * scale, 82 * scale, 40 * scale, 16 * scale, 8 * scale, themePalette.cyan);
  fillRoundedRect(pixels, size, 82 * scale, 40 * scale, 14 * scale, 58 * scale, 7 * scale, themePalette.coral);
  fillCircle(pixels, size, 89 * scale, 26 * scale, 8 * scale, themePalette.gold);

  fillRoundedRect(pixels, size, 30 * scale, 24 * scale, 24 * scale, 80 * scale, 12 * scale, [255, 255, 255, 20], true);
  fillRoundedRect(pixels, size, 78 * scale, 36 * scale, 22 * scale, 66 * scale, 11 * scale, [255, 255, 255, 16], true);

  if (options.addDetail) {
    fillRoundedRect(pixels, size, 100 * scale, 82 * scale, 10 * scale, 20 * scale, 4 * scale, themePalette.violet);
    fillCircle(pixels, size, 105 * scale, 92 * scale, 3 * scale, themePalette.white);
  }

  writePng(filePath, size, size, pixels);
}

function fillRoundedRect(pixels, size, x, y, width, height, radius, color, additive = false) {
  const minX = Math.max(0, Math.floor(x - 1));
  const minY = Math.max(0, Math.floor(y - 1));
  const maxX = Math.min(size - 1, Math.ceil(x + width + 1));
  const maxY = Math.min(size - 1, Math.ceil(y + height + 1));
  const maxRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distanceToShape = roundedRectDistance(px + 0.5, py + 0.5, x, y, width, height, maxRadius);
      if (distanceToShape <= 0) {
        blendPixel(pixels, size, px, py, color, additive ? 0.55 : 1);
      }
    }
  }
}

function strokeRoundedRect(pixels, size, x, y, width, height, radius, thickness, color) {
  const minX = Math.max(0, Math.floor(x - thickness - 1));
  const minY = Math.max(0, Math.floor(y - thickness - 1));
  const maxX = Math.min(size - 1, Math.ceil(x + width + thickness + 1));
  const maxY = Math.min(size - 1, Math.ceil(y + height + thickness + 1));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const outer = roundedRectDistance(px + 0.5, py + 0.5, x, y, width, height, radius);
      const inner = roundedRectDistance(px + 0.5, py + 0.5, x + thickness, y + thickness, width - thickness * 2, height - thickness * 2, Math.max(0, radius - thickness));
      if (outer <= 0 && inner > 0) {
        blendPixel(pixels, size, px, py, color, 1);
      }
    }
  }
}

function fillCircle(pixels, size, centerX, centerY, radius, color) {
  const minX = Math.max(0, Math.floor(centerX - radius - 1));
  const minY = Math.max(0, Math.floor(centerY - radius - 1));
  const maxX = Math.min(size - 1, Math.ceil(centerX + radius + 1));
  const maxY = Math.min(size - 1, Math.ceil(centerY + radius + 1));
  const radiusSquared = radius * radius;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px + 0.5 - centerX;
      const dy = py + 0.5 - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        blendPixel(pixels, size, px, py, color, 1);
      }
    }
  }
}

function roundedRectDistance(px, py, x, y, width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centerX = x + halfWidth;
  const centerY = y + halfHeight;
  const qx = Math.abs(px - centerX) - (halfWidth - radius);
  const qy = Math.abs(py - centerY) - (halfHeight - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function blendPixel(pixels, size, x, y, color, alphaMultiplier) {
  const index = (y * size + x) * 4;
  const sourceAlpha = (color[3] / 255) * alphaMultiplier;
  const destAlpha = pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);

  if (outAlpha <= 0) {
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const source = color[channel] / 255;
    const dest = pixels[index + channel] / 255;
    const out = (source * sourceAlpha + dest * destAlpha * (1 - sourceAlpha)) / outAlpha;
    pixels[index + channel] = Math.round(out * 255);
  }

  pixels[index + 3] = Math.round(outAlpha * 255);
}

function writePixel(pixels, index, color) {
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function mix(colorA, colorB, factor) {
  return colorA.map((value, index) => Math.round(value * (1 - factor) + colorB[index] * factor));
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function writePng(filePath, width, height, rgba) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;
    rows.push(Buffer.from([0]));
    rows.push(rgba.subarray(rowStart, rowStart + width * 4));
  }

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  const png = Buffer.concat([
    pngSignature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);

  fs.writeFileSync(filePath, png);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

const crcTable = buildCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

generateIcon(path.join(iconsDir, 'logi-extension.png'), 128, { transparent: false, addDetail: false });
generateIcon(path.join(iconsDir, 'logi-light.png'), 64, { transparent: false, addDetail: false });
generateIcon(path.join(iconsDir, 'logi-dark.png'), 64, { transparent: false, addDetail: false });
generateIcon(path.join(iconsDir, 'logid-light.png'), 64, { transparent: false, addDetail: true });
generateIcon(path.join(iconsDir, 'logid-dark.png'), 64, { transparent: false, addDetail: true });