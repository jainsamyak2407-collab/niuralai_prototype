import { deflateSync } from "node:zlib";

// Deterministic, deliberately low-information grayscale PNG for the "unreadable scan"
// fixture: a washed-out blur with faint smudges and no legible text.

const CRC_TABLE = (() => {
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

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function unreadableScanPng(): Uint8Array {
  const w = 240;
  const h = 160;
  let seed = 0x5eed;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(w + 1);
    row[0] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      // Soft gradient + faint horizontal smears that suggest text but carry none.
      const smear = y % 18 > 11 && x > 30 && x < 210 ? 14 * Math.sin((x + y) / 9) : 0;
      const v = 212 + 18 * Math.sin(x / 37) * Math.cos(y / 29) - Math.abs(smear) + (rand() - 0.5) * 10;
      row[x + 1] = Math.max(150, Math.min(250, Math.round(v)));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const text = chunk("tEXt", Buffer.from("Comment\0SYNTHETIC DEMO - NOT VALID FOR ENROLLMENT (unreadable scan fixture)", "latin1"));
  return new Uint8Array(Buffer.concat([sig, chunk("IHDR", ihdr), text, chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
