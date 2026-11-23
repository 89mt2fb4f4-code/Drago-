// Mission Control — tiny PMTiles (v3) reader.
//
// A PMTiles file is one big file holding every map tile plus an index. We
// never download it: we read only the bytes we need with HTTP Range requests
// (header → index → the one tile). Overture publishes its buildings and
// places this way. Spec: github.com/protomaps/PMTiles (spec/v3).
// No library needed; gzip is undone by the browser's DecompressionStream.

const HEADER_BYTES = 127;

async function readRange(url, offset, length, signal) {
  const res = await fetch(url, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}` },
    signal,
  });
  if (res.status !== 206 && res.status !== 200) throw new Error(`PMTiles HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // A server that ignores Range sends the whole file: refuse, don't slice.
  if (res.status === 200 && buf.length !== length) throw new Error('PMTiles server ignored Range');
  return buf;
}

async function decompress(bytes, kind) {
  if (kind === 1 || kind === 0) return bytes; // none / unknown
  if (kind !== 2) throw new Error(`PMTiles compression ${kind} not supported`);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Little-endian 64-bit as a JS number (file offsets go past 4 GB).
const u64 = (v, o) => v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;

function parseHeader(b) {
  const magic = String.fromCharCode(...b.subarray(0, 7));
  if (magic !== 'PMTiles' || b[7] !== 3) throw new Error('Not a PMTiles v3 file');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    rootOffset: u64(v, 8),
    rootLength: u64(v, 16),
    leafOffset: u64(v, 40),
    tileDataOffset: u64(v, 56),
    internalCompression: b[97],
    tileCompression: b[98],
    tileType: b[99],
    minZoom: b[100],
    maxZoom: b[101],
  };
}

function readVarints(bytes) {
  let pos = 0;
  return () => {
    let value = 0;
    let mult = 1;
    for (;;) {
      const byte = bytes[pos++];
      if (byte === undefined) throw new Error('PMTiles index ended early');
      value += (byte & 0x7f) * mult;
      if (byte < 0x80) return value;
      mult *= 128;
    }
  };
}

function parseDirectory(bytes) {
  const next = readVarints(bytes);
  const n = next();
  const entries = new Array(n);
  let id = 0;
  for (let i = 0; i < n; i++) {
    id += next();
    entries[i] = { tileId: id, runLength: 0, length: 0, offset: 0 };
  }
  for (let i = 0; i < n; i++) entries[i].runLength = next();
  for (let i = 0; i < n; i++) entries[i].length = next();
  for (let i = 0; i < n; i++) {
    const raw = next();
    entries[i].offset = raw === 0 && i > 0 ? entries[i - 1].offset + entries[i - 1].length : raw - 1;
  }
  return entries;
}

/** Tile id along the Hilbert curve, as the spec defines it. */
export function zxyToTileId(z, x, y) {
  let acc = 0;
  for (let a = 0; a < z; a++) acc += 4 ** a;
  let d = 0;
  for (let s = 2 ** (z - 1); s >= 1; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return acc + d;
}

function findEntry(entries, tileId) {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = entries[mid].tileId;
    if (c === tileId) return entries[mid];
    if (c < tileId) lo = mid + 1;
    else hi = mid - 1;
  }
  // The entry just before may cover a run of tiles, or point to a leaf index.
  if (hi >= 0) {
    const e = entries[hi];
    if (e.runLength === 0 || tileId - e.tileId < e.runLength) return e;
  }
  return null;
}

/** Open a remote PMTiles file. Returns { header, getTile(z, x, y) → bytes|null }. */
export function openPmtiles(url) {
  let headerPromise = null;
  const dirCache = new Map(); // offset → Promise<entries>

  const header = () => {
    headerPromise ??= readRange(url, 0, HEADER_BYTES).then(parseHeader).catch((err) => {
      headerPromise = null;
      throw err;
    });
    return headerPromise;
  };
  const directory = (h, offset, length) => {
    const key = `${offset}:${length}`;
    let p = dirCache.get(key);
    if (!p) {
      p = readRange(url, offset, length)
        .then((b) => decompress(b, h.internalCompression))
        .then(parseDirectory)
        .catch((err) => {
          dirCache.delete(key);
          throw err;
        });
      dirCache.set(key, p);
      if (dirCache.size > 64) dirCache.delete(dirCache.keys().next().value);
    }
    return p;
  };

  async function getTile(z, x, y, signal) {
    const h = await header();
    if (z < h.minZoom || z > h.maxZoom) return null;
    const id = zxyToTileId(z, x, y);
    let offset = h.rootOffset;
    let length = h.rootLength;
    for (let depth = 0; depth < 4; depth++) {
      const entry = findEntry(await directory(h, offset, length), id);
      if (!entry) return null;
      if (entry.runLength > 0) {
        const bytes = await readRange(url, h.tileDataOffset + entry.offset, entry.length, signal);
        return decompress(bytes, h.tileCompression);
      }
      offset = h.leafOffset + entry.offset;
      length = entry.length;
    }
    throw new Error('PMTiles index too deep');
  }

  return { header, getTile };
}
