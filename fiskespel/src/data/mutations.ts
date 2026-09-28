import type { AttributeDef, MutationDef } from '../core/types';

/**
 * Mutations: at most one per fish. Rolled after the species, only among mutations whose
 * conditions hold. Chances are per catch; the fishing system multiplies them by
 * economy.mutationMultiplier(), rod passives and event boosts.
 * Visual params are applied by models/fish (tint/emissive/pattern/particles).
 */
export const MUTATIONS: MutationDef[] = [
  { id: 'albino', name: 'Albino', multiplier: 1.2, chance: 0.03, description: 'Pale and pink-eyed.',
    visual: { tint: '#f4efe9', tintStrength: 0.85, roughness: 0.45, pattern: 'none' } },
  { id: 'dusky', name: 'Dusky', multiplier: 1.3, chance: 0.035, conditions: { time: 'night' }, description: 'Darkened by moonless water.',
    visual: { tint: '#1d2233', tintStrength: 0.7, roughness: 0.35, pattern: 'none' } },
  { id: 'sunkissed', name: 'Sunkissed', multiplier: 1.4, chance: 0.03, conditions: { time: 'day', weather: ['clear'] }, description: 'Warm golden glow from a long summer day.',
    visual: { tint: '#ffbf6b', tintStrength: 0.45, emissive: '#ff9a3c', emissiveStrength: 0.15, pattern: 'none', particles: 'none' } },
  { id: 'windswept', name: 'Windswept', multiplier: 1.4, chance: 0.04, conditions: { weather: ['windy'] }, description: 'Fins frayed by the gale.',
    visual: { tint: '#b8d4e0', tintStrength: 0.4, pattern: 'bands', patternColor: '#e9f6ff', particles: 'none' } },
  { id: 'rainsoaked', name: 'Rainsoaked', multiplier: 1.5, chance: 0.04, conditions: { weather: ['rain'] }, description: 'Glistening with fresh rain.',
    visual: { tint: '#3d6f9e', tintStrength: 0.45, roughness: 0.08, pattern: 'none', particles: 'bubbles' } },
  { id: 'mossy', name: 'Mossy', multiplier: 1.4, chance: 0.05, conditions: { zones: ['mirewood_bayou'] }, description: 'Overgrown with swamp moss.',
    visual: { tint: '#4f6b2a', tintStrength: 0.35, roughness: 0.9, pattern: 'moss', patternColor: '#6f9a2f' } },
  { id: 'barnacled', name: 'Barnacled', multiplier: 1.5, chance: 0.05, conditions: { zones: ['turtleback_atoll', 'stone_arch', 'open_ocean'] }, description: 'Crusted with barnacles.',
    visual: { tint: '#9a9181', tintStrength: 0.25, roughness: 0.85, pattern: 'barnacles', patternColor: '#d8d0bf' } },
  { id: 'ghostly', name: 'Ghostly', multiplier: 1.6, chance: 0.04, conditions: { weather: ['fog'] }, description: 'Half here, half somewhere else.',
    visual: { tint: '#cfe8ff', tintStrength: 0.75, opacity: 0.55, emissive: '#9fd4ff', emissiveStrength: 0.25, particles: 'smoke' } },
  { id: 'frosted', name: 'Frosted', multiplier: 1.6, chance: 0.05, conditions: { zones: ['frostpeak', 'frostpeak_lake'] }, description: 'Rimed with ice crystals.',
    visual: { tint: '#bfe9ff', tintStrength: 0.55, roughness: 0.25, pattern: 'crystals', patternColor: '#ffffff', particles: 'snow' } },
  { id: 'coralline', name: 'Coralline', multiplier: 1.7, chance: 0.05, conditions: { zones: ['coral_crescent'] }, description: 'Coral has started to grow on it.',
    visual: { tint: '#ff8fa3', tintStrength: 0.35, pattern: 'coral', patternColor: '#ff5f7e' } },
  { id: 'sunscorched', name: 'Sunscorched', multiplier: 1.8, chance: 0.04, conditions: { zones: ['sunspire_isle'], time: 'day' }, description: 'Baked by desert heat.',
    visual: { tint: '#c9772e', tintStrength: 0.5, roughness: 0.7, pattern: 'cracks', patternColor: '#5b2a0e' } },
  { id: 'tidal', name: 'Tidal', multiplier: 1.8, chance: 0.03, conditions: { weather: ['rain', 'storm'] }, description: 'Carries the pull of the tide.',
    visual: { tint: '#1f7fa8', tintStrength: 0.5, emissive: '#39c2ff', emissiveStrength: 0.2, pattern: 'bands', patternColor: '#7fe3ff', particles: 'bubbles' } },
  { id: 'molten', name: 'Molten', multiplier: 2.2, chance: 0.05, conditions: { zones: ['ashen_reach', 'ashen_lava'] }, description: 'Lava still glows in its cracks.',
    visual: { tint: '#2a1a14', tintStrength: 0.8, emissive: '#ff5a1a', emissiveStrength: 1.4, roughness: 0.8, pattern: 'cracks', patternColor: '#ff7a1a', particles: 'embers' } },
  { id: 'abyssal', name: 'Abyssal', multiplier: 2.4, chance: 0.04, conditions: { zones: ['deep_ocean', 'abyssal_trench'] }, description: 'Pressure-dark with glowing photophores.',
    visual: { tint: '#0b0f1c', tintStrength: 0.85, emissive: '#3cf2ff', emissiveStrength: 1.1, pattern: 'spots', patternColor: '#3cf2ff' } },
  { id: 'electric', name: 'Electric', multiplier: 2.5, chance: 0.04, conditions: { weather: ['storm'] }, description: 'Struck by lightning and lived.',
    visual: { tint: '#6fb9ff', tintStrength: 0.4, emissive: '#8fdcff', emissiveStrength: 1.2, pattern: 'veins', patternColor: '#e8fbff', particles: 'electric' } },
  { id: 'luminous', name: 'Luminous', multiplier: 2.8, chance: 0.04, conditions: { zones: ['glimmer_grotto'] }, description: 'Glows with the grotto’s light.',
    visual: { tint: '#7ffff0', tintStrength: 0.4, emissive: '#3dffd8', emissiveStrength: 1.3, pattern: 'spots', patternColor: '#c8fff6', particles: 'sparkle' } },
  { id: 'aurora', name: 'Aurora', multiplier: 3.0, chance: 0.06, conditions: { weather: ['aurora'] }, description: 'Shimmers with northern lights.',
    visual: { tint: '#6cffb0', tintStrength: 0.3, emissive: '#7a6cff', emissiveStrength: 0.8, iridescence: 1, pattern: 'bands', patternColor: '#9dffcf', particles: 'stardust' } },
  { id: 'ancient', name: 'Ancient', multiplier: 3.2, chance: 0.035, conditions: { zones: ['elder_isle'] }, description: 'Fossil-stone scales from another age.',
    visual: { tint: '#a3927a', tintStrength: 0.65, roughness: 0.95, pattern: 'cracks', patternColor: '#5d5142' } },
  { id: 'cursed', name: 'Cursed', multiplier: 3.5, chance: 0.03, conditions: { zones: ['wreckers_cove'], time: 'night' }, description: 'A pirate’s curse clings to it.',
    visual: { tint: '#2c1640', tintStrength: 0.7, emissive: '#8a2bff', emissiveStrength: 0.9, pattern: 'veins', patternColor: '#b76bff', particles: 'smoke' } },
  { id: 'golden', name: 'Golden', multiplier: 4.0, chance: 0.006, description: 'Solid gold. Somehow still swimming.',
    visual: { tint: '#ffcc33', tintStrength: 0.95, metalness: 1, roughness: 0.18, particles: 'sparkle' } },
  { id: 'crimson', name: 'Crimson', multiplier: 5.0, chance: 0.1, conditions: { event: 'crimson_moon' }, description: 'Born under the Crimson Moon.',
    visual: { tint: '#8a0012', tintStrength: 0.8, emissive: '#ff1a2e', emissiveStrength: 0.9, pattern: 'veins', patternColor: '#ff4455', particles: 'embers' } },
  { id: 'starborn', name: 'Starborn', multiplier: 6.0, chance: 0.08, conditions: { event: 'meteor_shower' }, description: 'Fell from the sky, landed in the sea.',
    visual: { tint: '#140c33', tintStrength: 0.9, emissive: '#b9a6ff', emissiveStrength: 0.7, pattern: 'stars', patternColor: '#ffffff', particles: 'stardust' } },
  { id: 'prismatic', name: 'Prismatic', multiplier: 8.0, chance: 0.0015, description: 'Every colour at once.',
    visual: { tint: '#ffffff', tintStrength: 0.2, iridescence: 1, metalness: 0.4, roughness: 0.15, particles: 'sparkle' } },
  { id: 'celestial', name: 'Celestial', multiplier: 10.0, chance: 0.0006, conditions: { time: 'night' }, description: 'A fragment of the night sky.',
    visual: { tint: '#fff6d6', tintStrength: 0.6, emissive: '#ffe9a8', emissiveStrength: 1.0, iridescence: 0.6, pattern: 'stars', patternColor: '#fffbe8', particles: 'stardust' } },
  { id: 'ethereal', name: 'Ethereal', multiplier: 12.0, chance: 0.0, special: true, description: 'Only the Keeper’s magic can make one.',
    visual: { tint: '#e6d9ff', tintStrength: 0.6, opacity: 0.7, emissive: '#c7b3ff', emissiveStrength: 1.2, iridescence: 1, particles: 'stardust' } },
];

export const ATTRIBUTES: AttributeDef[] = [
  { id: 'gleaming', name: 'Gleaming', multiplier: 1.8, chance: 0.02, description: 'An unusually bright sheen.', visual: { particles: 'sparkle', sheen: 1 } },
  { id: 'glittering', name: 'Glittering', multiplier: 1.8, chance: 0.02, description: 'Tiny glints dance across its scales.', visual: { particles: 'stardust', sheen: 0.6 } },
];

export const MUTATION_BY_ID: Record<string, MutationDef> = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]));
export const ATTRIBUTE_BY_ID: Record<string, AttributeDef> = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a]));
