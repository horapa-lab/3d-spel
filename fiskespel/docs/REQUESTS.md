
## economy (economy/platform author) — conventions + requests

**Conventions other systems can rely on (economy side):**
- `economy.addXp(amount)` / `addCoins(amount)` add the amount AS-IS (no multiplier applied inside).
  **Fishing** grants catch XP itself: `addXp(def.xp × perfect 1.5 × (1+xp_bonus) × economy.xpMultiplier(), 'catch')`.
  `economy.addCatch(c)` does NOT grant XP or coins (bestiary, stats, backpack only).
- `CaughtFish.value` = value incl. mutation/attributes/coin_bonus/perfect_bonus, EXCLUDING `sellMultiplier()`.
  `sell/sellAll` multiply by `sellMultiplier()` at sale time. Favourites are never sold.
- `effectiveRodStats()` = rod.stats + Σ enchant.stats (additive). It does NOT include boosts — boosts/events are
  exposed only via `luckMultiplier()/lureMultiplier()/xpMultiplier()/sellMultiplier()/mutationMultiplier()`
  (so nothing is applied twice). Enchant `effect`s are NOT folded in either: read `rodEnchants(rodId)` or the
  optional `activeEffects()` (rod passive + enchant effects in one list, types.ts `ActiveEffect`).
- `luckMultiplier()` includes the active world event's `effects.luckMult`; `xpMultiplier()` includes `effects.xpMult`.
  Per-mutation `mutationBoost` of events is left to fishing.
- Economy handles the `interact` event (npc → `ui:open {panel:'dialog', data:{npcId, role}}`, altar → `ui:open
  {panel:'enchant'}`, chest → open, boat_spawn → `player.spawnBoat()`, bestiary → `ui:open {panel:'bestiary'}`).
- Economy emits `ui:toast` itself for: level up + unlocks, discoveries, purchases (ok/fail), bestiary claims,
  quest turn-in, map decode, chest/crate loot summary, totems/potions. UI does not need to toast these again.

**→ lead (main.ts):**
1. After `createPlatform()` and the bus exist: `platform.onAd = (s) => events.emit(s === 'start' ? 'ad:start' : 'ad:end', {})`.
2. Please forward `equip:rod` to the player: `events.on('equip:rod', ({rodId}) => ctx.player.equipRod(rodId))`
   (economy only emits the event; it never calls player.equipRod itself).

**→ fishing:** please export PURE helpers (no THREE, no ctx) that the appraiser can reuse, and note the path here,
e.g. `src/game/fishing/roll.ts`: `rollWeight(def, rng, sizeUp?) → kg`, `sizeLabel(def, kg) → SizeLabel`,
`rollMutation(def, env, rng, mult?) → id|null`, `fishValue(def, kg, mutation, attributes) → number`.
Until then economy uses its own (kg = min+(max−min)·u², value = ceil(ceil(pricePerKg·kg)·mut·attrs)).
Also call `economy.consumeBait()` when a baited cast lands, and `economy.grantItem('<treasure map id>', 1)`
for the 1/200 treasure map roll.

**→ gear (items.ts):** economy reads these by `kind` (ids are yours):
- `bait_crate` items with `loot` + price + `soldAt` (sold by bait_vendor/merchant at that location).
- `treasure_chest` items with `loot` (price null) — used for chests spawned from decoded maps (economy picks one
  by island tier / rarity; `registry.build('item', id)` must work for them).
- one `treasure_map` item (kind `treasure_map`, price null).
- `relic` items for pools standard / exalted / cosmic with prices, `soldAt: 'keepers_monolith'` (Keeper + Warden Sable sell them).
- `totem` items (`soldAt: 'sunspire_isle'`, Zahra sells them), `potion` items (merchants).
- backpack upgrades: kind `'misc'` with the new optional field `backpack: { slots: N }` (types.ts), price,
  `soldAt`, optional `unlockLevel`. Economy uses built-in fallbacks (+10/+20/+40 slots) if none exist.
- bobbers: bestiary reward bobbers (price null); economy maps zones → bobber ids (see economy/bestiary.ts).

**→ ui:** when a chest / crate is opened economy calls `ui:open {panel:'items', data:{loot:[{kind,id?,amount}], title}}`
(also returned by `useItem`). Optional economy helpers for panels: `buyCheck`, `sellPreview`, `canEnchant`,
`bestiaryReward`, `questCooldownMs`, `decodeMap`, `mapCount`, `setSpawn`, `adReward(kind)`, `adRewardCooldownMs(kind)`.
