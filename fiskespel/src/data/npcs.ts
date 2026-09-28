import type { NpcDef } from '../core/types';

/**
 * Every NPC in the world. world/ places them (per location), models/characters builds them
 * from `look`, economy/ drives their shops/quests by `role` + `location`.
 */
export const NPCS: NpcDef[] = [
  // ── Driftwood Harbor (start) ────────────────────────────────────────────
  { id: 'marla', name: 'Marla Brine', role: 'merchant', location: 'driftwood_harbor',
    lines: ['Fresh rods, fresh bait, fair prices!', 'Sell your catch here, love.', 'Big fish? I pay by the kilo.'],
    look: { body: 'stocky', skin: '#e8b996', hair: '#8b4a2b', outfit: '#2f5d8a', accent: '#f2e3c6', hat: 'none', apron: true, age: 'adult' } },
  { id: 'tobias', name: 'Old Tobias', role: 'angler', location: 'driftwood_harbor',
    lines: ['Bring me a fish I ask for and I’ll make it worth your while.', 'Seventy years on this pier…'],
    look: { body: 'slim', skin: '#d9a47f', hair: '#d8d8d8', outfit: '#4d6b3c', accent: '#c9a45c', hat: 'straw', beard: true, age: 'old' } },
  { id: 'wren', name: 'Wren Hollis', role: 'appraiser', location: 'driftwood_harbor',
    lines: ['Let me take a closer look at that fish.', 'Weight, colour, pedigree… everything can change.'],
    look: { body: 'slim', skin: '#f1c9a5', hair: '#2b2b33', outfit: '#6b3f7a', accent: '#e0c15a', hat: 'none', glasses: true, age: 'adult' } },
  { id: 'oskar', name: 'Captain Oskar Reed', role: 'shipwright', location: 'driftwood_harbor',
    lines: ['A good boat opens the whole sea to you.', 'She floats, I promise.'],
    look: { body: 'stocky', skin: '#c98b62', hair: '#5a3a22', outfit: '#1f2f4a', accent: '#d4af37', hat: 'captain', beard: true, age: 'adult' } },
  { id: 'nell', name: 'Nell', role: 'innkeeper', location: 'driftwood_harbor',
    lines: ['Rest here and you’ll wake up in Driftwood.', 'Warm soup, warm bed.'],
    look: { body: 'average', skin: '#f3d0b5', hair: '#c4692e', outfit: '#8a3b32', accent: '#f6e7d2', hat: 'none', apron: true, age: 'young' } },
  { id: 'pip', name: 'Pip', role: 'bait_vendor', location: 'driftwood_harbor',
    lines: ['Worms! Shrimp! Crates of mystery bait!', 'Open a crate, maybe you get something rare!'],
    look: { body: 'slim', skin: '#8d5a3b', hair: '#1c1c1c', outfit: '#d9822b', accent: '#3a6ea5', hat: 'cap', age: 'young' } },
  { id: 'juno', name: 'Archivist Juno', role: 'bestiary_keeper', location: 'driftwood_harbor',
    lines: ['Complete a page of the bestiary and I’ll reward you.', 'Every fish has a story.'],
    look: { body: 'average', skin: '#6f4a33', hair: '#e6e6e6', outfit: '#3b4a6b', accent: '#c7a86b', hat: 'none', glasses: true, age: 'old' } },

  // ── Coral Crescent ─────────────────────────────────────────────────────
  { id: 'lani', name: 'Lani Coralsong', role: 'merchant', location: 'coral_crescent',
    lines: ['Aloha, angler! Reef gear right here.', 'Sell your catch, buy something shiny.'],
    look: { body: 'average', skin: '#b87a52', hair: '#1a1210', outfit: '#ff7f6e', accent: '#ffe08a', hat: 'none', age: 'young' } },
  { id: 'kai', name: 'Kai Driftwell', role: 'rod_crafter', location: 'coral_crescent',
    lines: ['Rods carved from driftwood and coral.', 'Luck lives in the grain of the wood.'],
    look: { body: 'stocky', skin: '#a8704a', hair: '#2d1b10', outfit: '#2a8c82', accent: '#f0d9a8', hat: 'bandana', age: 'adult' } },
  { id: 'ula', name: 'Ula Reef', role: 'angler', location: 'coral_crescent',
    lines: ['The reef fish are picky. Can you catch what I need?'],
    look: { body: 'slim', skin: '#c68b5e', hair: '#3a2416', outfit: '#3fb6c9', accent: '#ffffff', hat: 'straw', age: 'adult' } },

  // ── Sunspire Isle ──────────────────────────────────────────────────────
  { id: 'zahra', name: 'Zahra Sunweaver', role: 'totem_carver', location: 'sunspire_isle',
    lines: ['My totems bend the sky itself.', 'Rain, fog, night… for a price.'],
    look: { body: 'slim', skin: '#9c6a45', hair: '#101010', outfit: '#d49a3a', accent: '#6b2b1f', hat: 'hood', age: 'adult' } },
  { id: 'hakim', name: 'Hakim', role: 'merchant', location: 'sunspire_isle',
    lines: ['Water is precious here. Fish, even more.'],
    look: { body: 'average', skin: '#8a5a3a', hair: '#1a1a1a', outfit: '#e8dcc0', accent: '#2a6e8c', hat: 'bandana', beard: true, age: 'adult' } },
  { id: 'dune', name: 'Dune', role: 'angler', location: 'sunspire_isle',
    lines: ['Desert fishing is about patience.'],
    look: { body: 'slim', skin: '#b07b52', hair: '#6b4a2a', outfit: '#c2703a', accent: '#f2e0b6', hat: 'straw', age: 'young' } },

  // ── Turtleback Atoll ───────────────────────────────────────────────────
  { id: 'barnaby', name: 'Barnaby Keel', role: 'shipwright', location: 'turtleback_atoll',
    lines: ['Fastest hulls on the seven seas.', 'Upgrade your boat, see the world.'],
    look: { body: 'stocky', skin: '#e0a882', hair: '#b8b8b8', outfit: '#274b6b', accent: '#e9c46a', hat: 'captain', beard: true, age: 'old' } },
  { id: 'mags', name: 'Mags', role: 'innkeeper', location: 'turtleback_atoll',
    lines: ['Hammocks and coconut milk. Stay a while.'],
    look: { body: 'average', skin: '#d19a73', hair: '#f0d38a', outfit: '#48a9a6', accent: '#ffffff', hat: 'straw', age: 'adult' } },
  { id: 'coral_quinn', name: 'Quinn', role: 'bait_vendor', location: 'turtleback_atoll',
    lines: ['Lagoon bait, freshly dug.'],
    look: { body: 'slim', skin: '#f0c3a0', hair: '#7b3f1d', outfit: '#8fc93a', accent: '#35553a', hat: 'cap', age: 'young' } },

  // ── Mirewood Bayou ─────────────────────────────────────────────────────
  { id: 'mossmother', name: 'Old Mother Moss', role: 'merchant', location: 'mirewood_bayou',
    lines: ['Mushroom-wood rods, lucky as a toad.', 'Hehehe… sell me something slimy.'],
    look: { body: 'stocky', skin: '#b39c7d', hair: '#8c9c6a', outfit: '#4c5a2e', accent: '#b04a8c', hat: 'wizard', age: 'old' } },
  { id: 'jeb', name: 'Croaker Jeb', role: 'angler', location: 'mirewood_bayou',
    lines: ['Catfish, gar, bog-things… bring me one.'],
    look: { body: 'slim', skin: '#caa07c', hair: '#5a4a2a', outfit: '#6d5a3a', accent: '#a33', hat: 'straw', beard: true, age: 'adult' } },

  // ── The Stone Arch ─────────────────────────────────────────────────────
  { id: 'ansel', name: 'Hermit Ansel', role: 'angler', location: 'stone_arch',
    lines: ['The arch sings when the wind blows through it.', 'Fetch me a fish and I’ll share my secrets.'],
    look: { body: 'slim', skin: '#d8b08c', hair: '#efefef', outfit: '#7a6a55', accent: '#3d5a6c', hat: 'hood', beard: true, age: 'old' } },

  // ── Frostpeak ──────────────────────────────────────────────────────────
  { id: 'ingrid', name: 'Ingrid Frostmantle', role: 'merchant', location: 'frostpeak',
    lines: ['Cold-forged rods and warm prices.', 'Ice fishing? You’ll need a steady hand.'],
    look: { body: 'stocky', skin: '#f5d5c0', hair: '#f2e6c9', outfit: '#3a6fa3', accent: '#ffffff', hat: 'fur', age: 'adult' } },
  { id: 'bjorn', name: 'Bjorn', role: 'angler', location: 'frostpeak',
    lines: ['The lake freezes, the fish don’t.'],
    look: { body: 'stocky', skin: '#f0c7a8', hair: '#c46a2a', outfit: '#8a2f2f', accent: '#e8e8e8', hat: 'beanie', beard: true, age: 'adult' } },
  { id: 'sigrun', name: 'Sigrun', role: 'innkeeper', location: 'frostpeak',
    lines: ['Come in from the cold.'],
    look: { body: 'average', skin: '#f7dcc8', hair: '#e8d8a8', outfit: '#6a4a8a', accent: '#f0f0f0', hat: 'fur', age: 'young' } },

  // ── Wreckers' Cove ─────────────────────────────────────────────────────
  { id: 'rosa', name: 'One-Eyed Rosa', role: 'treasure_hunter', location: 'wreckers_cove',
    lines: ['Found a map? I can read the coordinates… for a fee.', 'X marks the spot, matey.'],
    look: { body: 'average', skin: '#c48860', hair: '#2a0f0f', outfit: '#7a1f1f', accent: '#d4af37', hat: 'tricorn', age: 'adult' } },
  { id: 'pete', name: 'Salty Pete', role: 'merchant', location: 'wreckers_cove',
    lines: ['Rods off the back of a ship. No questions.', 'Arr, cursed goods sell best.'],
    look: { body: 'stocky', skin: '#b5835f', hair: '#3a2a1a', outfit: '#2b2b2b', accent: '#b33', hat: 'bandana', beard: true, age: 'adult' } },
  { id: 'gully', name: 'Gully', role: 'angler', location: 'wreckers_cove',
    lines: ['The captain wants a special fish for supper.'],
    look: { body: 'slim', skin: '#e0b090', hair: '#a0522d', outfit: '#445566', accent: '#e8d8b0', hat: 'bandana', age: 'young' } },

  // ── Elder Isle ─────────────────────────────────────────────────────────
  { id: 'ottoline', name: 'Professor Ottoline', role: 'angler', location: 'elder_isle',
    lines: ['Living fossils swim in these waters!', 'For science — bring me a specimen.'],
    look: { body: 'slim', skin: '#e9c4a4', hair: '#7a7a7a', outfit: '#c9b27a', accent: '#5a3a1a', hat: 'straw', glasses: true, age: 'old' } },
  { id: 'thornwick', name: 'Thornwick', role: 'rod_crafter', location: 'elder_isle',
    lines: ['Rods grown from elder vines. They remember.'],
    look: { body: 'average', skin: '#8a6a4a', hair: '#2e4a1e', outfit: '#3e5a2a', accent: '#c2a24a', hat: 'hood', beard: true, age: 'old' } },

  // ── Glimmer Grotto ─────────────────────────────────────────────────────
  { id: 'luma', name: 'Luma', role: 'merchant', location: 'glimmer_grotto',
    lines: ['The crystals hum at night.', 'Glow-bait and grotto rods.'],
    look: { body: 'slim', skin: '#dcc6f0', hair: '#7fe7ff', outfit: '#2a2a5a', accent: '#7fffd4', hat: 'hood', age: 'young' } },
  { id: 'echo', name: 'Echo', role: 'angler', location: 'glimmer_grotto',
    lines: ['Echo… echo… bring me a glowing fish.'],
    look: { body: 'slim', skin: '#c9b3a3', hair: '#1a1a3a', outfit: '#3a4a7a', accent: '#9fffe0', hat: 'none', age: 'adult' } },

  // ── Keeper's Monolith ──────────────────────────────────────────────────
  { id: 'keeper', name: 'The Keeper', role: 'keeper', location: 'keepers_monolith',
    lines: ['Place a relic on the altar when the stars are out.', 'Your rod will be changed. For better, or for strange.'],
    look: { body: 'slim', skin: '#b8b0a0', hair: '#f0f0f0', outfit: '#3a3550', accent: '#c9b27a', hat: 'hood', beard: true, age: 'old' } },
  { id: 'sable', name: 'Warden Sable', role: 'merchant', location: 'keepers_monolith',
    lines: ['Relics, for those who seek change.'],
    look: { body: 'average', skin: '#6b4a3a', hair: '#1a1a1a', outfit: '#4a3a6a', accent: '#d4af37', hat: 'hood', age: 'adult' } },

  // ── Ashen Reach ────────────────────────────────────────────────────────
  { id: 'vulk', name: 'Forgemaster Vulk', role: 'rod_crafter', location: 'ashen_reach',
    lines: ['Only magma-forged rods survive the pools.', 'Heat makes steel honest.'],
    look: { body: 'stocky', skin: '#8a5a40', hair: '#1a1a1a', outfit: '#3a2a22', accent: '#ff6a1a', hat: 'none', apron: true, beard: true, age: 'adult' } },
  { id: 'cinder', name: 'Cinder', role: 'angler', location: 'ashen_reach',
    lines: ['Catch me something that swims in fire.'],
    look: { body: 'slim', skin: '#d9a07a', hair: '#ff5a1a', outfit: '#2a2a2a', accent: '#ff9a3a', hat: 'bandana', age: 'young' } },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
