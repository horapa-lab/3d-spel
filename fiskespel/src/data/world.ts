import type { LocationDef, WeatherDef, WorldEventDef } from '../core/types';

export const WEATHERS: WeatherDef[] = [
  { id: 'clear', name: 'Clear', weight: 34, description: 'Calm seas and blue skies.' },
  { id: 'cloudy', name: 'Overcast', weight: 20, description: 'Grey clouds roll over the islands.' },
  { id: 'rain', name: 'Rain', weight: 15, description: 'Steady rain. Some fish love it.' },
  { id: 'fog', name: 'Fog', weight: 10, description: 'Thick fog. Strange things surface.' },
  { id: 'windy', name: 'Windy', weight: 12, description: 'Strong winds whip up the waves.' },
  { id: 'storm', name: 'Storm', weight: 6, description: 'Thunder, lightning and huge swells.' },
  { id: 'aurora', name: 'Aurora', weight: 3, nightOnly: true, description: 'Northern lights dance above. Very lucky.' },
];

/**
 * Global world events. Scheduled deterministically from UTC time (see game/world-state/clock.ts)
 * so every player sees the same event at the same moment.
 */
export const WORLD_EVENTS: WorldEventDef[] = [
  { id: 'crimson_moon', name: 'Crimson Moon', time: 'night', probability: 0.12, color: '#ff2a3d',
    description: 'A blood-red moon rises. Crimson mutations and moon-only fish appear.',
    effects: { luckMult: 1.2, mutationBoost: [{ id: 'crimson', chanceMult: 1 }] } },
  { id: 'meteor_shower', name: 'Meteor Shower', time: 'night', probability: 0.07, color: '#b9a6ff',
    description: 'Stars fall into the sea. Starborn fish may bite.',
    effects: { luckMult: 1.3, mutationBoost: [{ id: 'starborn', chanceMult: 1 }] } },
  { id: 'golden_tide', name: 'Golden Tide', time: 'day', probability: 0.06, color: '#ffcc33',
    description: 'The sea shines gold. Golden mutations are 6x more common.',
    effects: { luckMult: 1.25, mutationBoost: [{ id: 'golden', chanceMult: 6 }] } },
  { id: 'great_migration', name: 'Great Migration', time: 'day', probability: 0.05, color: '#4fd6c6',
    description: 'Huge shoals pass by. +50% luck and double XP in the open sea.',
    effects: { luckMult: 1.5, xpMult: 2 } },
];

/** Fishing zones / locations. Island positions live in world/islands/layout.ts. */
export const LOCATIONS: LocationDef[] = [
  { id: 'driftwood_harbor', name: 'Driftwood Harbor', biome: 'temperate', tier: 1, kind: 'island',
    description: 'A cosy fishing village with a long wooden pier. Every angler starts here.' },
  { id: 'open_ocean', name: 'Open Ocean', biome: 'ocean', tier: 1, kind: 'water',
    description: 'The wide sea between the islands.' },
  { id: 'coral_crescent', name: 'Coral Crescent', biome: 'tropical', tier: 5, kind: 'island',
    description: 'A crescent-shaped tropical bay over bright coral reefs.' },
  { id: 'sunspire_isle', name: 'Sunspire Isle', biome: 'desert', tier: 10, kind: 'island',
    description: 'Sun-baked sandstone spires and the totem carver’s workshop.' },
  { id: 'turtleback_atoll', name: 'Turtleback Atoll', biome: 'atoll', tier: 12, kind: 'island',
    description: 'A ring of sand around a turquoise lagoon. Home of the best shipwright.' },
  { id: 'mirewood_bayou', name: 'Mirewood Bayou', biome: 'swamp', tier: 18, kind: 'island',
    description: 'Murky swamp water under giant glowing mushrooms.' },
  { id: 'stone_arch', name: 'The Stone Arch', biome: 'rock', tier: 20, kind: 'island',
    description: 'A colossal natural arch rising from the sea.' },
  { id: 'frostpeak', name: 'Frostpeak', biome: 'snow', tier: 28, kind: 'island',
    description: 'A snowy mountain island with icy shores.' },
  { id: 'frostpeak_lake', name: 'Frozen Lake', biome: 'snow', tier: 30, kind: 'sub', parent: 'frostpeak',
    description: 'An ice-fishing lake high on Frostpeak.' },
  { id: 'wreckers_cove', name: 'Wreckers’ Cove', biome: 'pirate', tier: 35, kind: 'island',
    description: 'Shipwrecks, pirates and buried treasure.' },
  { id: 'deep_ocean', name: 'Deep Ocean', biome: 'deep', tier: 40, kind: 'water',
    description: 'Far from land, the water turns dark and deep.' },
  { id: 'elder_isle', name: 'Elder Isle', biome: 'jungle', tier: 45, kind: 'island',
    description: 'Ancient ruins and waterfalls hidden in a prehistoric jungle.' },
  { id: 'glimmer_grotto', name: 'Glimmer Grotto', biome: 'grotto', tier: 55, kind: 'island',
    description: 'A sea cave lit by bioluminescent crystals.' },
  { id: 'keepers_monolith', name: 'Keeper’s Monolith', biome: 'monolith', tier: 60, kind: 'island',
    description: 'A giant stone guardian. Its altar enchants rods at night.' },
  { id: 'ashen_reach', name: 'Ashen Reach', biome: 'volcanic', tier: 70, kind: 'island',
    description: 'A smouldering volcano of black sand and basalt.' },
  { id: 'ashen_lava', name: 'Magma Pools', biome: 'volcanic', tier: 80, kind: 'sub', parent: 'ashen_reach',
    description: 'Pools of molten rock. Only heat-proof rods survive here.' },
  { id: 'abyssal_trench', name: 'Abyssal Trench', biome: 'abyss', tier: 90, kind: 'water',
    description: 'A bottomless trench marked by old warning buoys.' },
];

export const LOCATION_BY_ID: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
