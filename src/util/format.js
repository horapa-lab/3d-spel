// Number / time formatting helpers used all over the UI.

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function letterSuffix(i) {
  // aa, ab, ac ... after the named suffixes run out
  const a = Math.floor(i / 26);
  const b = i % 26;
  return String.fromCharCode(97 + (a % 26)) + String.fromCharCode(97 + b);
}

function trimZeros(str) {
  if (str.indexOf('.') === -1) return str;
  return str.replace(/0+$/, '').replace(/\.$/, '');
}

/** Short, idle-game style number: 950, 1.25K, 13.4M, 999B, 1.2aa */
export function fmt(n) {
  if (n === Infinity) return '∞';
  if (!Number.isFinite(n)) return '0';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) {
    if (n < 10 && n % 1 !== 0) return trimZeros(n.toFixed(1));
    return Math.floor(n).toString();
  }
  let i = Math.floor(Math.log10(n) / 3);
  let v = n / Math.pow(1000, i);
  if (v >= 999.5) {
    v /= 1000;
    i++;
  }
  const suf = i < SUFFIX.length ? SUFFIX[i] : letterSuffix(i - SUFFIX.length);
  const str = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return trimZeros(str) + suf;
}

/** Integer with thin spaces for small counters (kills etc.) */
export function fmtInt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return fmt(n);
  return n.toLocaleString('en-US');
}

/** 3725 -> "1h 2m", 125 -> "2m 5s", 9 -> "9s" */
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

/** mm:ss for short countdowns */
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function pct(v, digits = 1) {
  if (v >= 0.1) return trimZeros((v * 100).toFixed(digits)) + '%';
  if (v >= 0.001) return trimZeros((v * 100).toFixed(2)) + '%';
  return trimZeros((v * 100).toFixed(3)) + '%';
}
