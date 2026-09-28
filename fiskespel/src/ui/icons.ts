// OWNER: ui. Inline SVG icon set (all original, 24×24 grid). `icon(name)` returns markup.

const f = (d: string) => `<path d="${d}" fill="currentColor" stroke="none"/>`;
const p = (d: string) => `<path d="${d}"/>`;

function starPath(cx: number, cy: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  }
  return `${d}Z`;
}
function gearPath(): string {
  const teeth = 8;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    const pts: [number, number][] = [
      [a0 - w * 0.5, 7.4],
      [a0 - w * 0.2, 7.4],
      [a0 - w * 0.14, 10],
      [a0 + w * 0.14, 10],
      [a0 + w * 0.2, 7.4],
    ];
    for (const [a, r] of pts) d += `${d ? 'L' : 'M'}${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`;
  }
  return `${d}Z`;
}
function rays(cx: number, cy: number, r1: number, r2: number, n: number, rot = 0): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    d += `M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`;
  }
  return d;
}
function snowflake(): string {
  let d = rays(12, 12, 0, 9, 6, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * Math.PI * 2;
    const bx = 12 + Math.cos(a) * 5.6;
    const by = 12 + Math.sin(a) * 5.6;
    for (const s of [-1, 1]) {
      const b = a + s * 0.75;
      d += `M${bx.toFixed(2)} ${by.toFixed(2)}L${(bx + Math.cos(b) * 2.6).toFixed(2)} ${(by + Math.sin(b) * 2.6).toFixed(2)}`;
    }
  }
  return d;
}

const CLOUD = 'M7 18.5a4.5 4.5 0 0 1-.55-8.97A6 6 0 0 1 17.9 8.7 4.9 4.9 0 0 1 17.3 18.5z';
const CLOUD_HI = 'M7 14.5a4 4 0 0 1-.5-7.97A5.4 5.4 0 0 1 17 5.8a4.3 4.3 0 0 1-.4 8.7z';

export const ICONS: Record<string, string> = {
  close: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  check: p('M5 12.5l4.5 4.5L19 7.5'),
  plus: p('M12 5v14M5 12h14'),
  minus: p('M5 12h14'),
  chevL: p('M15 5l-7 7 7 7'),
  chevR: p('M9 5l7 7-7 7'),
  chevD: p('M5 9l7 7 7-7'),
  chevU: p('M5 15l7-7 7 7'),
  back: p('M19 12H5M11 6l-6 6 6 6'),
  arrowR: p('M5 12h14M13 6l6 6-6 6'),
  arrowUp: p('M12 19V5M6 11l6-6 6 6'),
  arrowDown: p('M12 5v14M6 13l6 6 6-6'),
  fish:
    f('M2.2 12c2.7-4 6.6-6.2 10.9-6.2 3 0 5.4 1.3 7 3.4L22.6 7v10l-2.5-2.2c-1.6 2.1-4 3.4-7 3.4C8.8 18.2 4.9 16 2.2 12z') +
    '<circle cx="7.3" cy="10.9" r="1.15" fill="rgba(4,20,32,.85)" stroke="none"/>' +
    '<path d="M10 8.6c1 1.2 1 5.6 0 6.8" stroke="rgba(4,20,32,.45)" stroke-width="1.3" fill="none"/>',
  fishOutline: p('M2.5 12c2.6-3.9 6.4-6 10.6-6 3 0 5.3 1.3 6.9 3.3L22.5 7v10l-2.5-2.3c-1.6 2-3.9 3.3-6.9 3.3-4.2 0-8-2.1-10.6-6z') + '<circle cx="7.4" cy="11" r="1" fill="currentColor"/>',
  backpack:
    p('M5.5 10.5A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.5V19a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z') +
    p('M9.5 4.6V3.8a2.5 2.5 0 0 1 5 0v.8') +
    p('M8.5 21v-4.5A1.5 1.5 0 0 1 10 15h4a1.5 1.5 0 0 1 1.5 1.5V21') +
    p('M8.8 10.5h6.4'),
  rod: p('M3.5 20.5L18.5 3.5') + '<circle cx="7" cy="16.7" r="2.1"/>' + p('M18.5 3.5V14a2.3 2.3 0 0 1-4.6 0v-1.2'),
  bait: p('M3 15.5c2.2 0 2.4-4.5 4.8-4.5s2.6 4.5 5 4.5 2.4-4.5 4.8-4.5c1.3 0 2.2 1 2.9 2') + '<circle cx="20.3" cy="12.4" r=".9" fill="currentColor"/>',
  hook: '<circle cx="15" cy="4.6" r="1.8"/>' + p('M15 6.4V15a5 5 0 0 1-10 0v-2.6L8 15'),
  book: p('M3 5.6C5.6 4 8.6 4 12 6.1c3.4-2.1 6.4-2.1 9-.5V19c-2.6-1.6-5.6-1.6-9 .5-3.4-2.1-6.4-2.1-9-.5z') + p('M12 6.1v13.4'),
  map: p('M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z') + p('M9 4v13.5M15 6.5V20'),
  gear: `<path d="${gearPath()}"/><circle cx="12" cy="12" r="3"/>`,
  sun: `<circle cx="12" cy="12" r="4.2"/><path d="${rays(12, 12, 6.8, 9.6, 8)}"/>`,
  sunFill: `<circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="${rays(12, 12, 7, 9.8, 8)}"/>`,
  moon: f('M20.2 14.6A8.2 8.2 0 1 1 9.4 3.8a6.6 6.6 0 0 0 10.8 10.8z'),
  moonLine: p('M20.2 14.6A8.2 8.2 0 1 1 9.4 3.8a6.6 6.6 0 0 0 10.8 10.8z'),
  cloud: p(CLOUD),
  rain: p(CLOUD_HI) + p('M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5'),
  fog: p('M7 11.5a4 4 0 0 1-.5-7.97A5.4 5.4 0 0 1 17 3.3a4.3 4.3 0 0 1 .9 8.2') + p('M3.5 15h17M5.5 18.5h13M8 22h8'),
  wind: p('M3 9.2h11.5a3 3 0 1 0-3-3') + p('M3 13.5h15.5a3 3 0 1 1-3 3') + p('M3 17.8h6'),
  storm: p(CLOUD_HI) + f('M12.6 13.2l-3.4 5.1h3l-1.2 4.4 4.6-6.2h-3.1l1.6-3.3z'),
  aurora: p('M4 20.5c.8-6 2-9.4 4.4-12.5M9.8 20.5c.3-6.2 1.6-9.6 4-13.4M15.6 20.5c.2-5.2 1.2-8.4 3.6-11.6') + f(starPath(19.2, 4.4, 2.4, 1, 4)),
  clear: `<circle cx="12" cy="12" r="4.2"/><path d="${rays(12, 12, 6.8, 9.6, 8)}"/>`,
  cloudy: p(CLOUD),
  windy: p('M3 9.2h11.5a3 3 0 1 0-3-3') + p('M3 13.5h15.5a3 3 0 1 1-3 3') + p('M3 17.8h6'),
  clock: '<circle cx="12" cy="12" r="9"/>' + p('M12 7v5l3.2 2'),
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/>' + p('M8 10.5V8a4 4 0 0 1 8 0v2.5') + p('M12 14.5v2.2'),
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/>' + p('M8 10.5V8a4 4 0 0 1 7.7-1.5'),
  star: f(starPath(12, 12.6, 10, 4.4)),
  starLine: p(starPath(12, 12.6, 9.4, 4.2)),
  heart: f('M12 20.4s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.6-8 10.6z'),
  heartLine: p('M12 20.4s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.6-8 10.6z'),
  tag: p('M3.5 12.4V4.6a1.1 1.1 0 0 1 1.1-1.1h7.8l8.1 8.1-8.9 8.9z') + '<circle cx="8" cy="8" r="1.6"/>',
  sparkle: f('M12 1.8l2.3 7.9 7.9 2.3-7.9 2.3L12 22.2l-2.3-7.9-7.9-2.3 7.9-2.3z'),
  sparkles: f('M10 3l1.8 6.2L18 11l-6.2 1.8L10 19l-1.8-6.2L2 11l6.2-1.8z') + f('M18.5 2.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8z'),
  anchor: '<circle cx="12" cy="5" r="2"/>' + p('M12 7v14M8 10.5h8M4.5 13.5a7.5 7.5 0 0 0 15 0'),
  boat: p('M2.8 16.6h18.4l-2.6 3.9H5.4z') + p('M12 3v12.2') + p('M12.4 4.2l6.4 10.2h-6.4') + p('M11 6.6L6 14.4h5'),
  chest: '<rect x="3.5" y="9.6" width="17" height="10" rx="1.6"/>' + p('M3.5 9.6c0-3.1 3.8-5.3 8.5-5.3s8.5 2.2 8.5 5.3') + p('M3.5 12.8h17') + '<rect x="10.4" y="11.2" width="3.2" height="3.6" rx=".8"/>',
  crate: '<rect x="3.5" y="5.5" width="17" height="14" rx="1.8"/>' + p('M3.5 10h17M3.5 15h17M8 5.5v14M16 5.5v14'),
  potion: p('M9.5 3h5M10.2 3v5.6L5.6 16.8a2.6 2.6 0 0 0 2.3 3.9h8.2a2.6 2.6 0 0 0 2.3-3.9l-4.6-8.2V3') + p('M7.4 14.4h9.2'),
  totem: '<rect x="7" y="3" width="10" height="18" rx="2"/>' + p('M7 9h10M7 15h10M4 11l3-2M20 11l-3-2') + f('M9.2 5.2h1.6v1.6H9.2zM13.2 5.2h1.6v1.6h-1.6z') + p('M10 12h4M10 18h4'),
  gem: p('M6.2 3.6h11.6l3.6 5L12 20.6 2.6 8.6z') + p('M2.6 8.6h18.8M9 3.6l-2 5 5 12 5-12-2-5'),
  relic: p('M6.2 3.6h11.6l3.6 5L12 20.6 2.6 8.6z') + p('M2.6 8.6h18.8M9 3.6l-2 5 5 12 5-12-2-5'),
  scroll: p('M6.5 4h11a2 2 0 0 1 2 2v1.5h-3') + p('M16.5 6v11.5a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-1h10.5v1a2.5 2.5 0 0 0 2.5 2.5') + p('M6.5 4a2 2 0 0 0-2 2v10.5') + p('M8 9h5M8 12.5h5'),
  quest: p('M4 5.6A2.6 2.6 0 0 1 6.6 3h10.8A2.6 2.6 0 0 1 20 5.6v7.8a2.6 2.6 0 0 1-2.6 2.6H10.2L5 20.2V16a2.6 2.6 0 0 1-1-2.1z') + p('M12 6.6v4.6') + '<circle cx="12" cy="13.4" r=".6" fill="currentColor"/>',
  talk: p('M4 5.6A2.6 2.6 0 0 1 6.6 3h10.8A2.6 2.6 0 0 1 20 5.6v7.8a2.6 2.6 0 0 1-2.6 2.6H10.2L5 20.2V16a2.6 2.6 0 0 1-1-2.1z') + p('M8.2 8.6h7.6M8.2 11.8h5'),
  search: '<circle cx="10.5" cy="10.5" r="6.5"/>' + p('M15.4 15.4L21 21'),
  appraise: '<circle cx="10.5" cy="10.5" r="6.5"/>' + p('M15.4 15.4L21 21') + f('M10.5 6.9l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z'),
  wand: p('M4 20.2L14.8 9.4') + p('M13.2 7.8l3 3') + f('M17.5 2.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z') + f('M8.5 3.4l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z') + f('M20.2 10.8l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z'),
  compass: '<circle cx="12" cy="12" r="9"/>' + f('M15.6 8.4l-2.3 5-4.9 2.2 2.2-4.9z'),
  play: f('M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z'),
  ad: '<rect x="2.8" y="4.8" width="18.4" height="12.8" rx="2.8"/>' + p('M8 21h8') + f('M10.2 8.6v5.3l4.4-2.65z'),
  clover:
    f('M12 11.3c-1.2-2.7-4.6-3.8-5.8-1.9-1.1 1.7.9 3.4 5.8 1.9zM12.7 12c2.7-1.2 3.8-4.6 1.9-5.8-1.7-1.1-3.4.9-1.9 5.8zM12 12.7c1.2 2.7 4.6 3.8 5.8 1.9 1.1-1.7-.9-3.4-5.8-1.9zM11.3 12c-2.7 1.2-3.8 4.6-1.9 5.8 1.7 1.1 3.4-.9 1.9-5.8z') +
    p('M13.6 13.6c1.6 2.2 3.7 4.8 6.6 6.6'),
  luck:
    f('M12 11.3c-1.2-2.7-4.6-3.8-5.8-1.9-1.1 1.7.9 3.4 5.8 1.9zM12.7 12c2.7-1.2 3.8-4.6 1.9-5.8-1.7-1.1-3.4.9-1.9 5.8zM12 12.7c1.2 2.7 4.6 3.8 5.8 1.9 1.1-1.7-.9-3.4-5.8-1.9zM11.3 12c-2.7 1.2-3.8 4.6-1.9 5.8 1.7 1.1 3.4-.9 1.9-5.8z') +
    p('M13.6 13.6c1.6 2.2 3.7 4.8 6.6 6.6'),
  bolt: f('M13.4 2.2L4.8 13.6h6.1l-1.3 8.2 8.8-11.6h-6.2z'),
  lure: f('M13.4 2.2L4.8 13.6h6.1l-1.3 8.2 8.8-11.6h-6.2z'),
  shield: p('M12 2.8l7.6 3v5.6c0 4.9-3.2 8.4-7.6 9.9-4.4-1.5-7.6-5-7.6-9.9V5.8z'),
  resilience: p('M12 2.8l7.6 3v5.6c0 4.9-3.2 8.4-7.6 9.9-4.4-1.5-7.6-5-7.6-9.9V5.8z') + p('M8.6 12l2.4 2.4 4.4-4.6'),
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  control: p('M3 12h3M18 12h3') + '<rect x="7" y="8" width="10" height="8" rx="2.4"/>' + p('M10.5 10.5v3M13.5 10.5v3'),
  weight: p('M8.6 8.6a3.4 3.4 0 1 1 6.8 0') + p('M6.6 8.6h10.8l2 11.6H4.6z'),
  info: '<circle cx="12" cy="12" r="9"/>' + p('M12 11v5.5') + '<circle cx="12" cy="7.8" r=".7" fill="currentColor"/>',
  trophy: p('M7.6 3.8h8.8v5.4a4.4 4.4 0 0 1-8.8 0z') + p('M7.6 5.6H4.8a3 3 0 0 0 3.2 4M16.4 5.6h2.8a3 3 0 0 1-3.2 4') + p('M12 13.6v3.4M8.4 20.6h7.2M9.6 17h4.8'),
  bed: p('M3 18.5v-11M3 14h18v4.5') + p('M21 14v-1.2a3 3 0 0 0-3-3h-6.6V14') + '<circle cx="7" cy="11" r="1.8"/>',
  flag: p('M5 21V3.8') + p('M5 4.4h11.2l-2.1 3.6 2.1 3.6H5'),
  jump: p('M12 17.5V5.5M6.5 11l5.5-5.5 5.5 5.5') + p('M5 21h14'),
  sprint: p('M5 6l6 6-6 6M12.5 6l6 6-6 6'),
  mouse: '<rect x="6.5" y="3" width="11" height="18" rx="5.5"/>' + p('M12 6.8v3.6'),
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/>' + p('M6 10h.01M9.3 10h.01M12.6 10h.01M16 10h.01M8 14h8'),
  speaker: f('M4 9.4h3.6L12.2 5.4v13.2l-4.6-4H4z') + p('M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.4a7.8 7.8 0 0 1 0 11.2'),
  music: p('M9 18V5.6l11-2.1V16') + '<circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  sliders: p('M4 7h9M17.6 7H20M4 17h3.4M11.6 17H20') + '<circle cx="15.4" cy="7" r="2.2"/><circle cx="9.4" cy="17" r="2.2"/>',
  filter: p('M3.5 5h17l-6.5 8v6l-4 2v-8z'),
  sort: p('M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5'),
  trash: p('M4 7h16M9.5 7V4.6h5V7M6 7l1.1 13h9.8L18 7'),
  crown: p('M3.4 8l4.6 4 4-7 4 7 4.6-4-2.1 11H5.5z'),
  hourglass: p('M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9'),
  drop: p('M12 3s6.6 7 6.6 11.6a6.6 6.6 0 0 1-13.2 0C5.4 10 12 3 12 3z'),
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/>' + p('M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8.5V21') + p('M12 8.5C10.5 4 6.5 4 6.8 6.6 7 8.3 10 8.5 12 8.5zM12 8.5c1.5-4.5 5.5-4.5 5.2-1.9-.2 1.7-3.2 1.9-5.2 1.9z'),
  pin: p('M12 21.2s7-6.2 7-11.6a7 7 0 0 0-14 0c0 5.4 7 11.6 7 11.6z') + '<circle cx="12" cy="9.6" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/>' + p('M4 21a8 8 0 0 1 16 0'),
  refresh: p('M20 11a8 8 0 0 0-14.5-4.6L4 8M4 3.8V8h4.2') + p('M4 13a8 8 0 0 0 14.5 4.6L20 16M20 20.2V16h-4.2'),
  eye: p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z') + '<circle cx="12" cy="12" r="3"/>',
  waves: p('M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2'),
  wave: p('M2 13c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3'),
  fire: p('M12 21.5c-4 0-7-2.8-7-6.8 0-4.5 4.5-6.2 4.5-11.2 3 2 4.5 4.5 4.5 7 1-.8 1.8-2 2-3.5 1.8 1.8 3 4.3 3 7.2 0 4.2-3 7.3-7 7.3z'),
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  leaf: p('M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z') + p('M5 19l8.5-8.5'),
  snow: p(snowflake()),
  season: p('M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z') + p('M5 19l8.5-8.5'),
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/>' + p('M3.5 10h17M8 3v4M16 3v4'),
  xp: f(starPath(12, 12, 10, 5.2, 4, -Math.PI / 2)),
  level: f(starPath(12, 12, 10, 5.2, 4, -Math.PI / 2)),
  bobber: p('M12 3v3') + '<circle cx="12" cy="13.5" r="6.5"/>' + p('M5.5 13.5h13'),
  rest: p('M4 18.5v-11M4 14h16v4.5') + p('M20 14v-1.2a3 3 0 0 0-3-3h-6V14') + '<circle cx="7.8" cy="11" r="1.7"/>' + p('M14.5 3.5h3l-3 3.5h3'),
  exit: p('M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4') + p('M10 16l-4-4 4-4M6 12h10'),
  shop: p('M4 9.5l1.4-5h13.2L20 9.5') + p('M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0') + p('M5.5 11.6V20h13v-8.4') + p('M10 20v-4.6h4V20'),
  coinsStack: '<ellipse cx="10" cy="7" rx="6" ry="2.6"/>' + p('M4 7v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7') + p('M8 16.4c.6.1 1.3.2 2 .2M4 11v4c0 1.4 2.7 2.6 6 2.6') + '<ellipse cx="15.5" cy="15.2" rx="4.8" ry="2.1"/>' + p('M10.7 15.2v3c0 1.2 2.1 2.1 4.8 2.1s4.8-.9 4.8-2.1v-3'),
  sellAll: '<ellipse cx="10" cy="7" rx="6" ry="2.6"/>' + p('M4 7v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7') + p('M4 11v4c0 1.4 2.7 2.6 6 2.6') + '<ellipse cx="15.5" cy="15.2" rx="4.8" ry="2.1"/>' + p('M10.7 15.2v3c0 1.2 2.1 2.1 4.8 2.1s4.8-.9 4.8-2.1v-3'),
  location: p('M12 21.2s7-6.2 7-11.6a7 7 0 0 0-14 0c0 5.4 7 11.6 7 11.6z') + '<circle cx="12" cy="9.6" r="2.5"/>',
  warn: p('M12 3.5L2.6 19.8a.8.8 0 0 0 .7 1.2h17.4a.8.8 0 0 0 .7-1.2z') + p('M12 9.6v5') + '<circle cx="12" cy="17.6" r=".7" fill="currentColor"/>',
  line: p('M4 4c4 4 12 4 16 16'),
  snap: p('M4 4c3 3 5 4 7 5M14 12c2 2 4.5 4.5 6 8') + p('M10 14l1.5-3.5M13 10.5l1.5 2'),
  sword: p('M14.5 3.5H20.5V9.5L9 21 3 15z'),
  eyeOff: p('M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 6.4C3.9 8.1 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.7-1.3'),
  expand: p('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  joystick: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/>',
  hand: p('M8 13V5.8a1.6 1.6 0 0 1 3.2 0V11M11.2 10.2V4.6a1.6 1.6 0 0 1 3.2 0v5.6M14.4 10.4V6.2a1.6 1.6 0 0 1 3.2 0v7.6a7 7 0 0 1-7 7h-.6a6.4 6.4 0 0 1-5.1-2.6L3.4 16a1.6 1.6 0 0 1 2.4-2.1L8 16'),
};

export type IconName = keyof typeof ICONS;

export function icon(name: string, cls = ''): string {
  const body = ICONS[name] ?? ICONS.info;
  return `<svg class="ri-ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Gold coin with an embossed fish (multi-colour). */
export function coinIcon(cls = ''): string {
  return `<svg class="ri-coin${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">
<circle cx="12" cy="12" r="10.6" fill="url(#ri-g-coin-rim)"/>
<circle cx="12" cy="12" r="8.4" fill="url(#ri-g-coin)"/>
<circle cx="12" cy="12" r="8.4" fill="none" stroke="#b9780f" stroke-opacity=".55" stroke-width=".9"/>
<path d="M6.3 12.2c1.5-2.2 3.6-3.4 5.9-3.4 1.6 0 2.9.7 3.8 1.8l1.6-1.3v5.6l-1.6-1.3c-.9 1.1-2.2 1.8-3.8 1.8-2.3 0-4.4-1.2-5.9-3.2z" fill="#a4640a" fill-opacity=".55"/>
<path d="M6.3 11.7c1.5-2.2 3.6-3.4 5.9-3.4 1.6 0 2.9.7 3.8 1.8l1.6-1.3v5.6l-1.6-1.3c-.9 1.1-2.2 1.8-3.8 1.8-2.3 0-4.4-1.2-5.9-3.2z" fill="#fff4c9" fill-opacity=".9"/>
<path d="M5.2 8.2A8.2 8.2 0 0 1 12 3.8" stroke="#fffbe6" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>
</svg>`;
}

/** Aqua XP gem. */
export function xpIcon(cls = ''): string {
  return `<svg class="ri-xpic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">
<path d="${starPath(12, 12, 11, 4.6, 4)}" fill="url(#ri-g-xp)"/>
<path d="${starPath(12, 12, 11, 4.6, 4)}" fill="none" stroke="#e8fffd" stroke-opacity=".6" stroke-width=".8"/>
<circle cx="12" cy="12" r="2.1" fill="#f2fffe"/>
</svg>`;
}

/** Shared gradients: installed once, referenced by id (never display:none). */
export function installIconDefs(): void {
  if (document.getElementById('ri-icon-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('id', 'ri-icon-defs');
  s.setAttribute('width', '0');
  s.setAttribute('height', '0');
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = `<defs>
<radialGradient id="ri-g-coin" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff2a8"/><stop offset=".45" stop-color="#ffd24a"/><stop offset="1" stop-color="#e79a12"/></radialGradient>
<linearGradient id="ri-g-coin-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#b56a07"/></linearGradient>
<linearGradient id="ri-g-xp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8fff4"/><stop offset=".5" stop-color="#3fe0cf"/><stop offset="1" stop-color="#1590b8"/></linearGradient>
<linearGradient id="ri-g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset="1" stop-color="#e9a432"/></linearGradient>
</defs>`;
  document.body.appendChild(s);
}

export function weatherIcon(w: string): string {
  return icon(({ clear: 'sun', cloudy: 'cloud', rain: 'rain', fog: 'fog', windy: 'wind', storm: 'storm', aurora: 'aurora' } as Record<string, string>)[w] ?? 'cloud');
}
export function seasonIcon(s: string): string {
  return icon(({ spring: 'leaf', summer: 'sunFill', autumn: 'leaf', winter: 'snow' } as Record<string, string>)[s] ?? 'leaf');
}
