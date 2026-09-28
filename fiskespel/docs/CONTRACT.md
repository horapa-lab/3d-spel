# Reel Isles — team contract (READ FULLY BEFORE WRITING CODE)

Reel Isles is a browser 3D fishing game for CrazyGames. Its feature set, concept and scale mirror
the Roblox hit *Fisch*: open archipelago, cast → shake → reel minigame, hundreds of fish with rarities,
weights and mutations, 40+ rods with stats and passives, baits, bait crates and treasure chests,
appraiser, bestiary with rewards, angler quests, day/night, weather, seasons, world events,
totems, relic enchanting, boats, levels.

**It must NOT be a clone in identity.** CrazyGames rejects clones. Never use Fisch names: no
"Moosewood", "Roslit", "Snowcap", "Sunstone", "Terrapin", "Mushgrove", "Forsaken", "Vertigo",
"Statue of Sovereignty", "Nessie", no Fisch rod names (Flimsy, Carbon, Steady, Reinforced,
Wingripper…), no Fisch mutation names beyond generic words, no copied UI layouts or art. All names,
models, text and numbers here are our own. Mechanics are fine to share.

UI text language: **English** (global CrazyGames audience).

## Art direction

"Premium stylised realism": the polish of *Sea of Thieves*, *Dredge*, *Tiny Glade*, *A Short Hike*
turned up to semi-realistic PBR — rich but harmonious colours, soft gradients, believable materials
(wet scales, lacquered wood, brushed brass, worn paint), clean readable silhouettes, subtle surface
detail from procedural textures/normal maps, bevelled edges, no flat untextured primitives, no
"programmer art". Water is the star: **hyper-realistic ocean**.

Everything 3D is **procedural** (built in code with Three.js geometry + procedural CanvasTextures /
DataTextures / shader materials). There is no internet asset access. Cache generated textures and
shared materials; never generate a texture per instance.

## Tech

- Vite + TypeScript (strict) + Three.js r186 (`import * as THREE from 'three'`, addons from
  `three/examples/jsm/...`). WebGL2 renderer (not WebGPU).
- Shared dev server: **http://127.0.0.1:5173/** (already running — do not start/kill it).
  If it is down, `tools/render.mjs` starts a private one automatically.
- Typecheck: `npx tsc --noEmit -p .` (whole project). Other authors are editing in parallel, so
  errors in files you do not own may appear briefly — only fix errors in YOUR files.
- Tests (pure logic): `npx vitest run tests/<yourfile>.test.ts`. Put tests under `tests/`.
- Do NOT run `vite build`, `npm install`, or git commands (no commits, no stash, no checkout).
  Need a new npm package? Append a request to `docs/REQUESTS.md`.
- The machine has 4 CPU cores shared by ~9 authors: keep screenshot batches reasonable
  (≤ 1600×1000, a handful of shots per run), never leave loops of renders running.

## Ownership (only edit files you own)

| Author | Owns |
|---|---|
| **lead** | `src/main.ts`, `src/core/**`, `src/data/{rarities,mutations,world,npcs,constants}.ts`, `src/lab/**`, `tools/**`, `docs/**`, `index.html`, `lab.html` |
| **render** (ocean/sky) | `src/render/**`, `src/world/ocean/**`, `src/world/sky/**` |
| **world** | `src/world/index.ts`, `src/world/islands/**`, `src/models/props/**` |
| **fish** | `src/models/fish/**`, `src/data/fish.ts` |
| **gear** | `src/models/rods/**`, `src/models/items/**`, `src/data/rods.ts`, `src/data/baits.ts`, `src/data/items.ts` |
| **player** | `src/game/player/**`, `src/models/characters/**`, `src/models/boats/**`, `src/data/boats.ts` |
| **fishing** | `src/game/fishing/**`, `src/game/world-state/**` |
| **economy** | `src/game/economy/**`, `src/platform/**`, `src/data/enchants.ts` |
| **ui** | `src/ui/**`, `src/styles.css` (extend only; keep `#game`, `#ui-root`, `#loading`) |
| **audio** | `src/audio/**` |

Everyone may: add files under their own folders; add tests under `tests/` prefixed with their
role (e.g. `tests/fishing-roll.test.ts`); **add new OPTIONAL members** to interfaces in
`src/core/types.ts` (never rename/remove/make-required); append to `docs/REQUESTS.md`.
Anything else in another author's file → write a request in `docs/REQUESTS.md` instead.

Each factory keeps its exact signature (see the stub you replace):
`createRenderSystem`, `detectQuality`, `createSky`, `createOcean`, `createWorld`, `createWorldClock`,
`createInput`, `createPlayer`, `createFishing`, `createEconomy`, `createPlatform`, `createUI`, `createAudio`.
`main.ts` wires them in this order: platform → render → clock → input → sky → ocean → world →
economy → player → fishing → audio → ui, then emits `game:ready`. In factories only use the core
context members (renderer, scene, camera, events, clock, input, quality, registry, platform) plus
systems created before you; everything else only inside `update()` or after `game:ready`.

## Contracts worth repeating

- Units = metres; sea surface rest level y = 0; +Y up. World spans roughly ±3000 m (6 km × 6 km).
- Content ids are shared: locations (`src/data/world.ts` LOCATIONS), NPCs (`src/data/npcs.ts`),
  mutations/attributes (`src/data/mutations.ts`), rarities (`src/data/rarities.ts`), events/weather.
  Starter ids in `src/data/constants.ts`: rod `starter_rod`, bobber `classic_bobber`.
- `FishDef.zone` may be `'*'` = catchable in every zone (use for global trash like boots/cans and
  for event-only fish with `event` set). The fishing system must honour `'*'`.
- Model conventions (see `ModelBuildOptions` doc in types.ts): fish length 1.0 facing +Z; rods along
  +Y with children `rodTip` and `rodGrip`; bobbers with `lineAttach`; characters 1.75 m, feet at 0,
  facing +Z, `handR` socket; boats facing +Z with `seat`; items rest on y = 0.
- A model may set `obj.userData.animate = (t:number) => void` on any child for idle animation
  (fish tail sway, flag flutter). The game and the lab call it every frame.
- Models are registered at import time: `registry.register(kind, { list, build, describe })`.
  `describe(id)` must return a one-sentence visual description (used by reviewers).

## Performance budget (the game must not lag — Chromebook 4 GB is a target device)

| Thing | Budget |
|---|---|
| Whole frame, quality `high` | ≤ 350 draw calls, ≤ 1.5 M triangles |
| Whole frame, quality `low` | ≤ 150 draw calls, ≤ 400 k triangles |
| Fish model LOD0 | ≤ 6 k tris |
| Rod | ≤ 4 k tris |
| Character / NPC | ≤ 8 k tris |
| Boat | ≤ 15 k tris |
| Building | ≤ 12 k tris (instance repeated props!) |
| Island at LOD0 | ≤ 250 k tris incl. vegetation (instanced), LOD/cull beyond ~600 m |
| Procedural textures | ≤ 1024², generated once, cached, shared |
| Initial JS download | as small as possible (no big data tables; generate procedurally) |

Quality tiers `low | medium | high | ultra` come from `ctx.quality` / `render.setQuality`. Respect them
(shadow map size, water detail, vegetation density, pixel ratio, post-processing).

## Economy guide (keep all authors consistent)

Average-weight sale value of one fish by rarity (zone tier scales within the band — early zones at
the low end, late zones at the high end):

| Rarity | Value of an average catch (coins) |
|---|---|
| trash | 1 – 10 |
| common | 8 – 60 |
| uncommon | 25 – 140 |
| unusual | 60 – 300 |
| rare | 150 – 900 |
| legendary | 700 – 4 500 |
| mythical | 3 000 – 20 000 |
| exotic | 12 000 – 90 000 |
| secret | 60 000 – 400 000 |
| limited (event) | 4 000 – 40 000 |

Rod ladder: starter free; early (lvl 1–10) 150 – 8 000; mid (10–40) 10 000 – 180 000;
late (40–90) 250 000 – 2 500 000; top rods via quests / bestiary completion / events / treasure.
Level curve target: level 10 ≈ 1 h, level 30 ≈ 6 h, level 60 ≈ 25 h, level 100 ≈ 80 h (cap 150).
A catch cycle (cast → bite → reel) takes ~10–20 s early game.

## The 3D Gauntlet (quality gate) — see docs/GAUNTLET.md

Every 3D model (fish, rods, bobbers, baits, crates, chests, relics, totems, characters, NPCs, boats,
buildings, props, vegetation, islands, water scenes) must score **≥ 8/10 from an independent
reviewer** before it is approved. Authors: render your work with `tools/render.mjs` + `lab.html`
(models) or `index.html` debug params (scenes), look at your own renders critically (Read the PNG)
and iterate BEFORE handing in. Put final review sheets under `review/renders/<role>/`.

## Hand-in

When done, reply with a SHORT report (≤ 250 words): what works, what is missing, the list of
review sheet PNG paths with the ids on each sheet, and any requests for other authors.
