// Chunky inline SVG icons (consistent on every OS, no emoji).

const INK = '#2b1d3a';
const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

export const ICONS = {
  coin: `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="24" fill="#e0a21a" ${S}/><circle cx="32" cy="30" r="24" fill="#ffd23f" ${S}/><circle cx="32" cy="30" r="15" fill="#ffe27a" stroke="#e0a21a" stroke-width="3"/><path d="M32 20v20M27 25h8a3 3 0 010 6h-6a3 3 0 000 6h8" fill="none" stroke="#c07a00" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  bolt: `<svg viewBox="0 0 64 64"><path d="M36 4L12 36h16l-4 24 26-34H34z" fill="#ffd23f" ${S}/><path d="M34 10L20 30" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/></svg>`,
  fire: `<svg viewBox="0 0 64 64"><path d="M32 4c4 12 18 16 18 32a18 18 0 01-36 0c0-8 4-12 8-16 0 6 3 9 6 9-2-10 0-18 4-25z" fill="#ff6b3d" ${S}/><path d="M32 30c3 6 10 8 10 16a10 10 0 01-20 0c0-5 4-8 6-10 0 4 2 5 4 5-1-4 0-8 0-11z" fill="#ffd23f"/></svg>`,
  gear: `<svg viewBox="0 0 64 64"><path d="M27 4h10l2 8 6 3 7-4 7 7-4 7 3 6 8 2v10l-8 2-3 6 4 7-7 7-7-4-6 3-2 8H27l-2-8-6-3-7 4-7-7 4-7-3-6-8-2V27l8-2 3-6-4-7 7-7 7 4 6-3z" fill="#e8ecf2" ${S}/><circle cx="32" cy="32" r="9" fill="#8a94a6" ${S}/></svg>`,
  shield: `<svg viewBox="0 0 64 64"><path d="M32 4l24 8v16c0 16-10 26-24 32C18 54 8 44 8 28V12z" fill="#38a6ff" ${S}/><path d="M32 12l16 6v10c0 11-7 18-16 22z" fill="#8fd0ff"/></svg>`,
  clover: `<svg viewBox="0 0 64 64"><g fill="#52e052" ${S}><circle cx="22" cy="22" r="11"/><circle cx="42" cy="22" r="11"/><circle cx="22" cy="42" r="11"/><circle cx="42" cy="42" r="11"/></g><circle cx="32" cy="32" r="5" fill="#2fa83a"/><path d="M40 46c6 6 8 10 10 14" fill="none" ${S}/></svg>`,
  vault: `<svg viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="46" rx="8" fill="#b9c2cf" ${S}/><circle cx="30" cy="31" r="14" fill="#8b95a3" ${S}/><path d="M30 20v22M19 31h22M22 23l16 16M38 23L22 39" stroke="#d8ad45" stroke-width="3"/><rect x="48" y="22" width="5" height="18" rx="2" fill="${INK}"/><rect x="12" y="54" width="8" height="6" fill="${INK}"/><rect x="44" y="54" width="8" height="6" fill="${INK}"/></svg>`,
  slot: `<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="12" fill="#4cd964" ${S}/><path d="M32 18v28M18 32h28" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg>`,
  gun: `<svg viewBox="0 0 64 64"><path d="M6 22h44l4-4h4v12H38l-4 4v6h-8l-4 16H10l6-18-10-2z" fill="#6e7a8a" ${S}/><rect x="12" y="24" width="30" height="5" fill="#9fb0c4"/><path d="M26 34h8v6h-8z" fill="${INK}"/></svg>`,
  crate: `<svg viewBox="0 0 64 64"><rect x="6" y="22" width="52" height="34" rx="4" fill="#c98244" ${S}/><path d="M6 14l52 0 0 10-52 0z" fill="#e0a052" ${S}/><path d="M16 22v34M48 22v34" stroke="${INK}" stroke-width="4"/><rect x="27" y="18" width="10" height="12" rx="2" fill="#ffd23f" ${S}/></svg>`,
  skull: `<svg viewBox="0 0 64 64"><path d="M32 6c14 0 24 9 24 22 0 7-3 11-7 14v8H15v-8c-4-3-7-7-7-14C8 15 18 6 32 6z" fill="#f2eee2" ${S}/><circle cx="23" cy="28" r="6" fill="${INK}"/><circle cx="41" cy="28" r="6" fill="${INK}"/><path d="M32 36l-3 6h6z" fill="${INK}"/><path d="M24 50v8M32 50v8M40 50v8" ${S}/></svg>`,
  star: `<svg viewBox="0 0 64 64"><path d="M32 4l8 18 20 2-15 13 5 20-18-11-18 11 5-20L4 24l20-2z" fill="#ffd23f" ${S}/></svg>`,
  sound: `<svg viewBox="0 0 64 64"><path d="M8 24h12l14-12v40L20 40H8z" fill="#e8ecf2" ${S}/><path d="M42 22c4 5 4 15 0 20M49 16c8 9 8 23 0 32" fill="none" ${S}/></svg>`,
  music: `<svg viewBox="0 0 64 64"><path d="M24 14l30-8v36" fill="none" ${S}/><path d="M24 14v34" ${S}/><circle cx="16" cy="48" r="8" fill="#b45cff" ${S}/><circle cx="46" cy="42" r="8" fill="#b45cff" ${S}/></svg>`,
  close: `<svg viewBox="0 0 64 64"><path d="M16 16l32 32M48 16L16 48" stroke="#fff" stroke-width="10" stroke-linecap="round"/></svg>`,
  up: `<svg viewBox="0 0 64 64"><path d="M32 6L8 32h14v24h20V32h14z" fill="#4cd964" ${S}/></svg>`,
  trophy: `<svg viewBox="0 0 64 64"><path d="M18 6h28v14a14 14 0 01-28 0z" fill="#ffd23f" ${S}/><path d="M18 12H8c0 10 5 14 12 14M46 12h10c0 10-5 14-12 14" fill="none" ${S}/><path d="M28 34h8v10h-8z" fill="#e0a21a" ${S}/><rect x="18" y="44" width="28" height="12" rx="3" fill="#8a5a2b" ${S}/></svg>`,
  clock: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#fff" ${S}/><path d="M32 16v16l10 8" fill="none" ${S}/></svg>`,
  play: `<svg viewBox="0 0 64 64"><rect x="4" y="12" width="56" height="40" rx="10" fill="#ff4d5e" ${S}/><path d="M26 22l16 10-16 10z" fill="#fff"/></svg>`,
  lock: `<svg viewBox="0 0 64 64"><path d="M20 28v-8a12 12 0 0124 0v8" fill="none" ${S}/><rect x="12" y="28" width="40" height="30" rx="6" fill="#ffd23f" ${S}/><circle cx="32" cy="42" r="4" fill="${INK}"/></svg>`,
  hand: `<svg viewBox="0 0 64 64"><path d="M26 30V10a5 5 0 0110 0v18l12 3c5 1 7 5 6 10l-3 14H26L14 40c-2-3 0-7 4-7 3 0 5 2 8 4z" fill="#fff" ${S}/></svg>`,
  arrowDown: `<svg viewBox="0 0 64 64"><path d="M32 60L6 30h16V4h20v26h16z" fill="#ffd23f" ${S}/></svg>`,
};

let factory = null;
/** 3D rendered icons (see icons3d.js) replace the flat SVGs once the renderer exists. */
export function setIconFactory(f) {
  factory = f;
}
const THREE_D = new Set(['coin', 'bolt', 'fire', 'shield', 'clover', 'vault', 'slot', 'up', 'star', 'gear', 'skull', 'clock', 'music', 'sound', 'lock', 'trophy', 'arrowDown', 'play', 'gun', 'crate']);

export function iconUrl(name) {
  return factory && THREE_D.has(name) ? factory.get(name) : '';
}

export function icon(name, cls = '') {
  const url = iconUrl(name);
  if (url) return `<span class="ic ic3d ${cls}"><img src="${url}" alt="" draggable="false"></span>`;
  return `<span class="ic ${cls}">${ICONS[name] || ''}</span>`;
}
