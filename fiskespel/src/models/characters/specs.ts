/**
 * Character appearance specs (OWNER: player author). NPC specs are derived from `NPCS[].look`
 * (src/data/npcs.ts) plus the per-NPC styling table below (gender presentation, hair, clothing
 * cut, extras). Player variants are defined here too.
 */
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import type { NpcDef } from '../../core/types';
import type { BeardStyle, HairStyle, HatStyle } from './head';

export type TopStyle = 'shirt' | 'tshirt' | 'sweater' | 'blouse' | 'vest' | 'coat' | 'raincoat' | 'robe' | 'tunic' | 'overalls' | 'jacket';
export type LowerStyle = 'trousers' | 'shorts' | 'skirt' | 'long_skirt';
export type SleeveStyle = 'long' | 'rolled' | 'short';
export type Extra =
  | 'pipe'
  | 'book'
  | 'loupe'
  | 'flower'
  | 'necklace'
  | 'earrings'
  | 'scarf'
  | 'sash'
  | 'staff'
  | 'gloves'
  | 'satchel'
  | 'suspenders'
  | 'bucket'
  | 'eyepatch'
  | 'glow_eyes'
  | 'glow_trim'
  | 'fur_trim'
  | 'lantern'
  | 'shell_necklace'
  | 'pockets'
  | 'life_vest';

export interface CharSpec {
  id: string;
  name: string;
  fem: boolean;
  body: 'slim' | 'average' | 'stocky';
  age: 'young' | 'adult' | 'old';
  skin: string;
  hair: string;
  eye: string;
  hairStyle: HairStyle;
  beard: BeardStyle;
  hat: HatStyle;
  hatColor: string;
  hatAccent: string;
  top: TopStyle;
  topColor: string;
  /** under-shirt / secondary garment colour (shirt under vest/coat/overalls) */
  innerColor: string;
  accent: string;
  pattern?: { kind: 'stripes' | 'plaid' | 'pinstripe' | 'check'; color: string; freq: number; on: 'top' | 'inner' };
  sleeves: SleeveStyle;
  lower: LowerStyle;
  lowerColor: string;
  bootColor: string;
  boots: 'boots' | 'tall' | 'shoes' | 'rubber' | 'fur';
  belt: string | null;
  apron: string | null;
  glasses: string | null;
  extras: Extra[];
  /** face variation */
  face: { nose: number; hook: number; jaw: number; lips: number; brow: number; smile: number };
  heightMul?: number;
  description: string;
}

const eyeFor = (skin: string, hair: string, i: number): string => {
  const pal = ['#5b3a1e', '#3d5f7a', '#4f6b3a', '#6b4a2a', '#2f4f6f', '#7a5a2a', '#3a3a3a', '#5a7a8a'];
  // darker skins → darker eyes mostly
  const lum = parseInt(skin.slice(1, 3), 16) + parseInt(skin.slice(3, 5), 16) + parseInt(skin.slice(5, 7), 16);
  if (lum < 450) return ['#3a2414', '#2a1a10', '#4a2e18'][i % 3];
  void hair;
  return pal[i % pal.length];
};

type NpcStyle = Partial<CharSpec> & Pick<CharSpec, 'fem' | 'hairStyle' | 'top' | 'lower' | 'description'>;

/** Per-NPC styling on top of NpcDef.look. */
const NPC_STYLE: Record<string, NpcStyle> = {
  marla: {
    fem: true, hairStyle: 'bun', top: 'blouse', sleeves: 'rolled', lower: 'long_skirt', lowerColor: '#3b3230', innerColor: '#2f5d8a',
    bootColor: '#4a3326', boots: 'boots', extras: ['earrings'], face: { nose: 0.5, hook: 0, jaw: 0.6, lips: 0.7, brow: 0.3, smile: 0.8 },
    description: 'Marla Brine: a stocky, cheerful harbour fishmonger with auburn hair in a bun, a navy blouse with rolled sleeves, a cream canvas apron over a long dark skirt, and brown boots.',
  },
  tobias: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'sweater', sleeves: 'long', lower: 'trousers', lowerColor: '#8a7a5a', bootColor: '#2b3a2e', boots: 'rubber',
    extras: ['pipe', 'suspenders'], face: { nose: 0.8, hook: 0.3, jaw: 0.4, lips: 0.3, brow: 0.7, smile: 0.5 },
    description: 'Old Tobias: a thin, weathered old angler with a white beard and a pipe, a battered straw hat, an olive cable-knit sweater with tan braces, canvas trousers and green rubber boots.',
  },
  wren: {
    fem: true, hairStyle: 'bob', top: 'vest', sleeves: 'long', innerColor: '#efe6d6', lower: 'trousers', lowerColor: '#2c2a33', bootColor: '#2a1c16', boots: 'shoes',
    extras: ['loupe'], face: { nose: 0.4, hook: 0, jaw: 0.3, lips: 0.6, brow: 0.2, smile: 0.3 },
    description: 'Wren Hollis: a slim, precise appraiser with a black bob and round gold glasses, a plum waistcoat with gold buttons over a cream shirt, dark trousers and polished shoes, holding a brass loupe.',
  },
  oskar: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'coat', sleeves: 'long', innerColor: '#e8e2d4', lower: 'trousers', lowerColor: '#1a2233', bootColor: '#1c1512', boots: 'tall',
    extras: ['pipe'], face: { nose: 0.7, hook: 0.2, jaw: 0.9, lips: 0.4, brow: 0.8, smile: 0.4 },
    description: 'Captain Oskar Reed: a broad, bearded shipwright captain in a navy double-breasted coat with brass buttons, a white-topped captain\'s cap with gold braid, tall black boots and a pipe.',
  },
  nell: {
    fem: true, hairStyle: 'ponytail', top: 'blouse', sleeves: 'long', lower: 'long_skirt', lowerColor: '#8a3b32', innerColor: '#f6e7d2', bootColor: '#3a2618', boots: 'boots',
    extras: [], face: { nose: 0.3, hook: 0, jaw: 0.2, lips: 0.7, brow: 0.2, smile: 1 },
    description: 'Nell: a young, friendly innkeeper with a ginger ponytail and freckled cheeks, a cream blouse under a brick-red dress, a white apron and brown boots.',
  },
  pip: {
    fem: false, hairStyle: 'curly', top: 'overalls', sleeves: 'short', innerColor: '#d9822b', lower: 'trousers', lowerColor: '#3a6ea5', bootColor: '#2c2a28', boots: 'rubber',
    extras: ['bucket'], heightMul: 0.95, face: { nose: 0.35, hook: 0, jaw: 0.3, lips: 0.5, brow: 0.3, smile: 1 },
    description: 'Pip: a lively young bait seller in a blue cap, an orange T-shirt under blue dungarees, black rubber boots, carrying a tin bait bucket.',
  },
  juno: {
    fem: true, hairStyle: 'bun', top: 'coat', sleeves: 'long', innerColor: '#e8dcc6', lower: 'long_skirt', lowerColor: '#2c3550', bootColor: '#2a1c16', boots: 'shoes',
    extras: ['book', 'necklace'], face: { nose: 0.5, hook: 0.1, jaw: 0.4, lips: 0.6, brow: 0.4, smile: 0.6 },
    description: 'Archivist Juno: an elderly scholar with a white bun and half-moon glasses, a long slate-blue scholar\'s coat with tan trim, a long skirt, holding a leather-bound bestiary.',
  },
  lani: {
    fem: true, hairStyle: 'long', top: 'blouse', sleeves: 'short', lower: 'long_skirt', lowerColor: '#ffe08a', innerColor: '#ff7f6e', bootColor: '#8a5a3a', boots: 'shoes',
    extras: ['flower', 'shell_necklace'], pattern: { kind: 'stripes', color: '#ffb3a6', freq: 5, on: 'top' },
    face: { nose: 0.4, hook: 0, jaw: 0.3, lips: 0.8, brow: 0.2, smile: 1 },
    description: 'Lani Coralsong: a sunny young reef trader with long black hair and a hibiscus flower, a striped coral blouse, a shell necklace and a long yellow sarong skirt.',
  },
  kai: {
    fem: false, hairStyle: 'short', top: 'tshirt', sleeves: 'short', lower: 'trousers', lowerColor: '#d8c49a', bootColor: '#5a3a24', boots: 'boots',
    extras: ['shell_necklace', 'gloves'], face: { nose: 0.6, hook: 0, jaw: 0.8, lips: 0.5, brow: 0.6, smile: 0.6 },
    description: 'Kai Driftwell: a sturdy rod carver in a sand-coloured bandana, a teal T-shirt, a shell necklace, leather work gloves and rolled sand trousers.',
  },
  ula: {
    fem: true, hairStyle: 'ponytail', top: 'shirt', sleeves: 'rolled', lower: 'shorts', lowerColor: '#f2efe6', bootColor: '#6a4a30', boots: 'shoes',
    extras: [], face: { nose: 0.4, hook: 0, jaw: 0.3, lips: 0.6, brow: 0.3, smile: 0.7 },
    description: 'Ula Reef: a slim reef angler with a dark ponytail under a straw hat, an aqua shirt with rolled sleeves, white shorts and brown deck shoes.',
  },
  zahra: {
    fem: true, hairStyle: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#d49a3a', bootColor: '#5a3a24', boots: 'shoes',
    extras: ['necklace', 'sash', 'earrings'], face: { nose: 0.6, hook: 0.3, jaw: 0.3, lips: 0.7, brow: 0.4, smile: 0.3 },
    description: 'Zahra Sunweaver: a slim desert totem carver in a flowing saffron robe with a maroon hood and sash, gold jewellery and dark kohl-lined eyes.',
  },
  hakim: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'tunic', sleeves: 'long', lower: 'trousers', lowerColor: '#d2c4a4', bootColor: '#6a4a30', boots: 'shoes',
    extras: ['sash'], face: { nose: 0.8, hook: 0.5, jaw: 0.6, lips: 0.5, brow: 0.6, smile: 0.5 },
    description: 'Hakim: a desert merchant with a neat black beard and a blue head-wrap, a long cream linen tunic with a blue sash, loose trousers and leather slippers.',
  },
  dune: {
    fem: false, hairStyle: 'short', top: 'shirt', sleeves: 'rolled', lower: 'trousers', lowerColor: '#e8d8b0', bootColor: '#7a5234', boots: 'boots',
    extras: ['scarf'], heightMul: 1.02, face: { nose: 0.5, hook: 0.1, jaw: 0.5, lips: 0.5, brow: 0.4, smile: 0.4 },
    description: 'Dune: a lanky young desert angler in a wide straw hat, a rust shirt with rolled sleeves, a cream neck scarf, sand trousers and suede boots.',
  },
  barnaby: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'coat', sleeves: 'long', innerColor: '#f0ebe0', lower: 'trousers', lowerColor: '#1e2c3e', bootColor: '#1c1512', boots: 'tall',
    extras: [], face: { nose: 0.9, hook: 0.2, jaw: 0.9, lips: 0.4, brow: 0.9, smile: 0.6 },
    description: 'Barnaby Keel: a big, grey-bearded old shipwright with a round belly, a blue captain\'s coat with gold buttons, a captain\'s cap and tall black sea boots.',
  },
  mags: {
    fem: true, hairStyle: 'long', top: 'blouse', sleeves: 'short', lower: 'long_skirt', lowerColor: '#f4f0e6', innerColor: '#48a9a6', bootColor: '#8a5a3a', boots: 'shoes',
    extras: ['necklace'], face: { nose: 0.5, hook: 0, jaw: 0.4, lips: 0.8, brow: 0.3, smile: 1 },
    description: 'Mags: a relaxed island innkeeper with long wavy blonde hair under a straw hat, a teal short-sleeved blouse, a long white skirt and sandals.',
  },
  coral_quinn: {
    fem: true, hairStyle: 'pigtails', top: 'overalls', sleeves: 'short', innerColor: '#8fc93a', lower: 'shorts', lowerColor: '#35553a', bootColor: '#35553a', boots: 'rubber',
    extras: ['bucket'], heightMul: 0.96, face: { nose: 0.3, hook: 0, jaw: 0.2, lips: 0.5, brow: 0.2, smile: 1 },
    description: 'Quinn: a young lagoon bait digger with auburn pigtails, a dark green cap, a lime T-shirt under green dungaree shorts, rubber boots and a bait bucket.',
  },
  mossmother: {
    fem: true, hairStyle: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#3e4a26', bootColor: '#3a2e1e', boots: 'boots',
    extras: ['necklace', 'staff'], heightMul: 0.94, face: { nose: 1, hook: 0.9, jaw: 0.3, lips: 0.3, brow: 0.6, smile: 0.7 },
    description: 'Old Mother Moss: a hunched old swamp witch with a big hooked nose and messy moss-green hair, a tall moss-green wizard hat sprouting magenta mushrooms, a patched green robe and a gnarled staff.',
  },
  jeb: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'overalls', sleeves: 'rolled', innerColor: '#a33333', lower: 'trousers', lowerColor: '#6d5a3a', bootColor: '#3a3026', boots: 'rubber',
    pattern: { kind: 'plaid', color: '#3a1a1a', freq: 2.2, on: 'inner' }, face: { nose: 0.7, hook: 0.1, jaw: 0.6, lips: 0.4, brow: 0.6, smile: 0.5 },
    description: 'Croaker Jeb: a lanky, scruffy bayou angler with a brown beard, a frayed straw hat, a red plaid shirt with rolled sleeves under brown dungarees, and muddy rubber boots.',
  },
  ansel: {
    fem: false, hairStyle: 'long', beard: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#6a5a45', bootColor: '#3a2e22', boots: 'boots',
    extras: ['staff'], face: { nose: 0.8, hook: 0.4, jaw: 0.3, lips: 0.3, brow: 0.9, smile: 0.2 },
    description: 'Hermit Ansel: a gaunt old hermit with a long white beard, a hooded taupe cloak-robe with slate trim, and a tall wooden walking staff.',
  },
  ingrid: {
    fem: true, hairStyle: 'pigtails', top: 'coat', sleeves: 'long', innerColor: '#e8e8e8', lower: 'trousers', lowerColor: '#2e3a4a', bootColor: '#6a5a4a', boots: 'fur',
    extras: ['fur_trim', 'gloves'], face: { nose: 0.5, hook: 0, jaw: 0.6, lips: 0.6, brow: 0.3, smile: 0.6 },
    description: 'Ingrid Frostmantle: a sturdy northern trader with platinum braids, a white fur hat, a blue fur-trimmed winter coat, mittens and fur-lined boots.',
  },
  bjorn: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'sweater', sleeves: 'long', lower: 'trousers', lowerColor: '#3a3a42', bootColor: '#4a3a2c', boots: 'fur',
    pattern: { kind: 'stripes', color: '#e8e8e8', freq: 1.6, on: 'top' }, face: { nose: 0.8, hook: 0.1, jaw: 0.9, lips: 0.4, brow: 0.8, smile: 0.6 },
    description: 'Bjorn: a burly ice fisherman with a huge ginger beard, a grey knit beanie, a red striped knit sweater, dark trousers and fur-lined boots.',
  },
  sigrun: {
    fem: true, hairStyle: 'braid', top: 'sweater', sleeves: 'long', lower: 'long_skirt', lowerColor: '#3a2e4a', bootColor: '#6a5a4a', boots: 'fur',
    pattern: { kind: 'stripes', color: '#f0f0f0', freq: 1.6, on: 'top' }, face: { nose: 0.3, hook: 0, jaw: 0.2, lips: 0.7, brow: 0.2, smile: 0.9 },
    description: 'Sigrun: a young northern innkeeper with a long blonde braid, a white fur hat, a purple knit sweater with white bands, a long skirt and fur boots.',
  },
  rosa: {
    fem: true, hairStyle: 'long', top: 'coat', sleeves: 'long', innerColor: '#f0e6d2', lower: 'trousers', lowerColor: '#2a1a14', bootColor: '#1c1210', boots: 'tall',
    extras: ['eyepatch', 'earrings', 'sash'], face: { nose: 0.5, hook: 0.2, jaw: 0.5, lips: 0.8, brow: 0.5, smile: 0.4 },
    description: 'One-Eyed Rosa: a swaggering treasure hunter with long dark curls, a black eyepatch, a gold-trimmed tricorn, a crimson long coat with gold trim, a white shirt, a sash and tall black boots.',
  },
  pete: {
    fem: false, hairStyle: 'short', beard: 'full', top: 'shirt', sleeves: 'rolled', innerColor: '#f0ece0', lower: 'trousers', lowerColor: '#2b2b2b', bootColor: '#1c1512', boots: 'tall',
    pattern: { kind: 'stripes', color: '#1e1e22', freq: 2.4, on: 'top' }, extras: ['sash', 'earrings'],
    face: { nose: 0.9, hook: 0.4, jaw: 0.8, lips: 0.4, brow: 0.8, smile: 0.3 },
    description: 'Salty Pete: a burly pirate fence with a dark beard and gold earring, a red bandana, a black-and-white striped sailor shirt with rolled sleeves, a red sash, black trousers and tall boots.',
  },
  gully: {
    fem: false, hairStyle: 'short', top: 'shirt', sleeves: 'rolled', lower: 'trousers', lowerColor: '#5a4a3a', bootColor: '#3a2a1e', boots: 'shoes',
    pattern: { kind: 'stripes', color: '#e8d8b0', freq: 2.4, on: 'top' }, heightMul: 0.97,
    face: { nose: 0.4, hook: 0, jaw: 0.3, lips: 0.5, brow: 0.3, smile: 0.8 },
    description: 'Gully: a young freckled deckhand with copper hair under a slate bandana, a slate-and-cream striped shirt with rolled sleeves, patched brown trousers and worn shoes.',
  },
  ottoline: {
    fem: true, hairStyle: 'bun', top: 'shirt', sleeves: 'rolled', lower: 'trousers', lowerColor: '#b09a68', bootColor: '#5a3a1a', boots: 'tall',
    extras: ['satchel', 'pockets'], face: { nose: 0.6, hook: 0.2, jaw: 0.3, lips: 0.4, brow: 0.5, smile: 0.6 },
    description: 'Professor Ottoline: a wiry elderly naturalist with a grey bun, round glasses and a straw explorer hat, a khaki field shirt with pockets, a leather satchel, khaki trousers and tall brown boots.',
  },
  thornwick: {
    fem: false, hairStyle: 'long', beard: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#3e5a2a', bootColor: '#3a2e1e', boots: 'boots',
    extras: ['sash', 'necklace'], face: { nose: 0.8, hook: 0.3, jaw: 0.4, lips: 0.3, brow: 0.8, smile: 0.4 },
    description: 'Thornwick: an old druid rod-crafter with a long moss-dark beard, a hooded green robe with a gold-thread sash and a carved wooden pendant.',
  },
  luma: {
    fem: true, hairStyle: 'bob', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#2a2a5a', bootColor: '#1e1e3a', boots: 'shoes',
    extras: ['glow_trim', 'necklace'], face: { nose: 0.3, hook: 0, jaw: 0.2, lips: 0.6, brow: 0.2, smile: 0.5 },
    description: 'Luma: an ethereal young grotto mystic with lavender skin and cyan hair, an indigo hooded robe with glowing aquamarine trim and a crystal pendant.',
  },
  echo: {
    fem: false, hairStyle: 'swept', top: 'coat', sleeves: 'long', innerColor: '#2a3050', lower: 'trousers', lowerColor: '#20243a', bootColor: '#15161f', boots: 'tall',
    extras: ['glow_trim', 'lantern'], face: { nose: 0.5, hook: 0.1, jaw: 0.5, lips: 0.4, brow: 0.4, smile: 0.1 },
    description: 'Echo: a quiet, pale cave angler with swept midnight hair, a long dark-blue coat with softly glowing mint trim, dark trousers, tall boots and a small crystal lantern.',
  },
  keeper: {
    fem: false, hairStyle: 'long', beard: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#3a3550', bootColor: '#1e1c28', boots: 'boots',
    extras: ['staff', 'glow_eyes', 'sash'], heightMul: 1.05, face: { nose: 0.8, hook: 0.3, jaw: 0.4, lips: 0.3, brow: 1, smile: 0 },
    description: 'The Keeper: a tall, ancient hooded sage with pale glowing eyes, a long white beard, a deep violet robe with a gold sash, holding a tall staff.',
  },
  sable: {
    fem: true, hairStyle: 'long', top: 'robe', sleeves: 'long', lower: 'long_skirt', lowerColor: '#4a3a6a', bootColor: '#1e1a24', boots: 'boots',
    extras: ['necklace', 'sash', 'earrings'], face: { nose: 0.5, hook: 0.1, jaw: 0.5, lips: 0.7, brow: 0.5, smile: 0.2 },
    description: 'Warden Sable: a composed relic warden in a hooded violet robe with gold trim and sash, gold earrings and a medallion.',
  },
  vulk: {
    fem: false, hairStyle: 'crop', beard: 'full', top: 'shirt', sleeves: 'rolled', innerColor: '#3a2a22', lower: 'trousers', lowerColor: '#2a221c', bootColor: '#1c1612', boots: 'tall',
    extras: ['gloves'], face: { nose: 0.9, hook: 0.2, jaw: 1, lips: 0.4, brow: 1, smile: 0.2 },
    description: 'Forgemaster Vulk: a massive black-bearded blacksmith with a heavy leather apron over a dark shirt with rolled sleeves, thick forge gloves, soot and ember-orange accents.',
  },
  cinder: {
    fem: true, hairStyle: 'spiky', top: 'jacket', sleeves: 'long', innerColor: '#ff9a3a', lower: 'trousers', lowerColor: '#222222', bootColor: '#151515', boots: 'boots',
    extras: [], face: { nose: 0.3, hook: 0, jaw: 0.3, lips: 0.6, brow: 0.4, smile: 0.4 },
    description: 'Cinder: a fiery young volcano angler with spiky flame-orange hair under an orange bandana, a charcoal jacket over an orange top, dark trousers and heavy boots.',
  },
};

function hatColors(look: NpcDef['look'], id: string): { hatColor: string; hatAccent: string } {
  switch (look.hat) {
    case 'straw':
      return { hatColor: '#d8b877', hatAccent: look.accent };
    case 'captain':
      return { hatColor: '#f2efe8', hatAccent: look.accent };
    case 'fur':
      return { hatColor: id === 'ingrid' ? '#f4f1ea' : '#f0ece4', hatAccent: '#e9e4da' };
    case 'beanie':
      return { hatColor: '#8f959c', hatAccent: look.accent };
    case 'cap':
      return { hatColor: look.accent, hatAccent: look.outfit };
    case 'bandana':
      return { hatColor: id === 'hakim' ? look.accent : id === 'kai' ? look.accent : id === 'gully' ? look.outfit : id === 'cinder' ? look.accent : '#b33333', hatAccent: '#f0e6d0' };
    case 'hood':
      return { hatColor: id === 'zahra' ? look.accent : look.outfit, hatAccent: look.accent };
    case 'wizard':
      return { hatColor: look.outfit, hatAccent: look.accent };
    case 'tricorn':
      return { hatColor: '#1e1614', hatAccent: look.accent };
    default:
      return { hatColor: look.outfit, hatAccent: look.accent };
  }
}

export function npcSpec(id: string): CharSpec {
  const def = NPC_BY_ID[id];
  const st = NPC_STYLE[id];
  const idx = NPCS.findIndex((n) => n.id === id);
  if (!def) throw new Error(`unknown npc ${id}`);
  const look = def.look;
  const base: CharSpec = {
    id,
    name: def.name,
    fem: st?.fem ?? false,
    body: look.body,
    age: look.age ?? 'adult',
    skin: look.skin,
    hair: look.hair,
    eye: eyeFor(look.skin, look.hair, idx),
    hairStyle: st?.hairStyle ?? 'short',
    beard: look.beard ? (st?.beard ?? 'full') : (st?.fem ? 'none' : look.age === 'young' ? 'none' : 'stubble'),
    hat: (look.hat ?? 'none') as HatStyle,
    ...hatColors(look, id),
    top: st?.top ?? 'shirt',
    topColor: look.outfit,
    innerColor: st?.innerColor ?? look.accent,
    accent: look.accent,
    pattern: st?.pattern,
    sleeves: st?.sleeves ?? 'long',
    lower: st?.lower ?? 'trousers',
    lowerColor: st?.lowerColor ?? '#3a3a40',
    bootColor: st?.bootColor ?? '#3a2a1e',
    boots: st?.boots ?? 'boots',
    belt: '#3a2618',
    apron: look.apron ? (id === 'vulk' ? '#4a3222' : look.accent) : null,
    glasses: look.glasses ? (id === 'wren' ? '#c9a24a' : id === 'juno' ? '#8a7a5a' : '#2a2a2a') : null,
    extras: st?.extras ?? [],
    face: st?.face ?? { nose: 0.5, hook: 0, jaw: 0.5, lips: 0.5, brow: 0.5, smile: 0.5 },
    heightMul: st?.heightMul,
    description: st?.description ?? `${def.name}, a ${look.body} ${look.age ?? 'adult'} ${def.role.replace('_', ' ')}.`,
  };
  if (id === 'nell') base.apron = '#f6f1e6';
  if (id === 'marla') base.apron = '#efe3c8';
  if (base.top === 'robe' || base.lower === 'long_skirt') base.belt = base.extras.includes('sash') ? null : base.belt;
  if (id === 'keeper' || id === 'ansel' || id === 'thornwick' || id === 'luma' || id === 'sable' || id === 'zahra') base.belt = null;
  if (base.beard !== 'none' && base.beard !== 'stubble' && look.age === 'old' && base.beard === 'full' && id !== 'barnaby') base.beard = 'full';
  if (id === 'tobias') base.beard = 'full';
  return base;
}

// ────────────────────────────────────────────────────────────── player variants

export const PLAYER_SPECS: CharSpec[] = [
  {
    id: 'player',
    name: 'Angler',
    fem: false,
    body: 'average',
    age: 'adult',
    skin: '#e3b28c',
    hair: '#5a3b24',
    eye: '#3d5f7a',
    hairStyle: 'short',
    beard: 'stubble',
    hat: 'beanie',
    hatColor: '#2e4a6a',
    hatAccent: '#2e4a6a',
    top: 'raincoat',
    topColor: '#e8b422',
    innerColor: '#e9e2d0',
    accent: '#2b3440',
    sleeves: 'long',
    lower: 'trousers',
    lowerColor: '#2f3d52',
    bootColor: '#5a3a24',
    boots: 'boots',
    belt: null,
    apron: null,
    glasses: null,
    extras: [],
    face: { nose: 0.5, hook: 0.1, jaw: 0.6, lips: 0.5, brow: 0.5, smile: 0.5 },
    description: 'The player angler: a young adult man with short brown hair and stubble, a navy knit beanie, a mustard-yellow fisherman\'s rain slicker with toggles over a cream knit, navy trousers and brown leather boots.',
  },
  {
    id: 'player_b',
    name: 'Angler (B)',
    fem: true,
    body: 'slim',
    age: 'young',
    skin: '#f0c8a8',
    hair: '#9a4a24',
    eye: '#4f6b3a',
    hairStyle: 'ponytail',
    beard: 'none',
    hat: 'cap',
    hatColor: '#c8452f',
    hatAccent: '#e9e2d0',
    top: 'vest',
    topColor: '#5a6b3a',
    innerColor: '#ece4d2',
    accent: '#c8452f',
    sleeves: 'rolled',
    lower: 'trousers',
    lowerColor: '#3a4a5e',
    bootColor: '#2c3a2e',
    boots: 'rubber',
    belt: '#4a3222',
    apron: null,
    glasses: null,
    extras: ['pockets'],
    face: { nose: 0.3, hook: 0, jaw: 0.2, lips: 0.6, brow: 0.2, smile: 0.7 },
    description: 'Player variant B: a young woman with an auburn ponytail through a red cap, an olive fishing vest with pockets over a cream shirt with rolled sleeves, jeans and green rubber boots.',
  },
  {
    id: 'player_c',
    name: 'Angler (C)',
    fem: false,
    body: 'stocky',
    age: 'adult',
    skin: '#8a5a3c',
    hair: '#1a1410',
    eye: '#3a2414',
    hairStyle: 'curly',
    beard: 'full',
    hat: 'bucket',
    hatColor: '#6b7a4a',
    hatAccent: '#3a3226',
    top: 'shirt',
    topColor: '#a8322a',
    innerColor: '#e8e0d0',
    accent: '#2a2a2a',
    pattern: { kind: 'plaid', color: '#2a1a1a', freq: 2.2, on: 'top' },
    sleeves: 'rolled',
    lower: 'trousers',
    lowerColor: '#8a7a58',
    bootColor: '#4a3020',
    boots: 'boots',
    belt: '#2a1a12',
    apron: null,
    glasses: null,
    extras: [],
    face: { nose: 0.7, hook: 0.1, jaw: 0.8, lips: 0.7, brow: 0.6, smile: 0.7 },
    description: 'Player variant C: a stocky bearded man with dark curly hair under an olive bucket hat, a red plaid flannel shirt with rolled sleeves, khaki trousers and brown boots.',
  },
  {
    id: 'player_d',
    name: 'Angler (D)',
    fem: true,
    body: 'average',
    age: 'adult',
    skin: '#c99672',
    hair: '#16121a',
    eye: '#3a2a1a',
    hairStyle: 'bob',
    beard: 'none',
    hat: 'none',
    hatColor: '#000000',
    hatAccent: '#000000',
    top: 'sweater',
    topColor: '#2a6e8c',
    innerColor: '#2a6e8c',
    accent: '#f08a3a',
    sleeves: 'long',
    lower: 'trousers',
    lowerColor: '#3a3430',
    bootColor: '#6a4a30',
    boots: 'boots',
    belt: null,
    apron: null,
    glasses: null,
    extras: ['life_vest'],
    face: { nose: 0.4, hook: 0, jaw: 0.3, lips: 0.7, brow: 0.3, smile: 0.6 },
    description: 'Player variant D: a woman with a black bob, a teal knit sweater under an orange life vest with buckles, dark trousers and brown boots.',
  },
];

export const PLAYER_SPEC_BY_ID: Record<string, CharSpec> = Object.fromEntries(PLAYER_SPECS.map((s) => [s.id, s]));
