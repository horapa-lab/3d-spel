# Build a Gun Army

Ett 3D idle-spel i webbläsaren (Three.js) i stil med klassiska idle-mobilspel, gjort för
CrazyGames och andra spelportaler.

Zombies och monster väller ut ur en portal och marscherar mot din barrikad. Du går fram till
**loot-lådan** i mitten av basen och öppnar den. Ut kommer ett slumpat vapen (vanliga vapen
ofta, super-sällsynta sällan) som flyger upp på vapenväggarna till höger och vänster och
skjuter automatiskt. Döda zombies ger pengar som du lägger på fler lådor och uppgraderingar.

## Innehåll

- **26 procedurellt modellerade vapen** i 7 rariteter: Common → Uncommon → Rare → Epic →
  Legendary → Mythic → SECRET. Från Mini Pistol (Glock-stil) till AK, M4, snipers,
  LMG, granatkastare, Minigun, Bazooka, RPG, eldkastare, Tesla-kanon, Plasma-minigun, Railgun,
  Nuke Launcher, Black Hole Gun och Unicorn Blaster.
- **Guld-vapen** (2 % chans, dubbel skada) och **sammanslagning**: dubbletter levlar upp vapen.
- **Loot-lådan**: gå in i den gula cirkeln, lådan skakar och färgen stegras genom rariteterna,
  locket flyger upp, en ljuspelare skjuter upp och vapnet visas i en helskärms-reveal.
  Pity-system: garanterad Epic+ inom 30 lådor. Boss-lådor ger minst Rare.
- **Uppgraderingar**: Firepower, Fire Rate, Coin Bonus, Gun Slots (4 → 32 platser),
  Barricade, Crate Luck (bättre odds och snyggare lådor) och Idle Vault (offline-intjäning).
- **Offline-intjäning** som ökar med Idle Vault-nivån, med "Welcome back"-popup.
- **Oändliga vågor** med 6 monstertyper, en boss var 5:e våg och en ny zon var 10:e våg
  (öken, kanjon, snö, giftträsk, vulkan och månbas).
- **Arsenal**: samlingsbok med 3D-renderade miniatyrer, odds-tabell och lista över din armé.
- Allt ljud syntetiseras med WebAudio (inga ljudfiler), och musiken loopar.
- Sparar automatiskt (CrazyGames data-modul om den finns, annars localStorage).

## Kontroller

| | |
|---|---|
| Gå | WASD / piltangenter, eller klicka och dra var som helst (joystick) |
| Gå till en punkt | Klicka på marken eller på lådan/stationerna |
| Uppgraderingar | U |
| Arsenal | I / Tab |
| Gå till lådan | E / Space |
| Ljud av/på | M |
| Meny / stäng | Esc |

## Köra lokalt

```bash
npm install
npm run dev        # utvecklingsserver
npm run build      # produktionsbygge till dist/
npm run preview    # testa bygget
npm run sim        # balanssimulering av ekonomin
```

Debug-parametrar i URL:en: `?reset=1`, `?coins=50000`, `?wave=20`, `?army=16`,
`?debug=1` (FPS-räknare), `?q=low|medium|high`, `?showcase=guns` och `?showcase=chars`
(visar alla modeller).

## Ladda upp till CrazyGames

1. `npm run build`
2. Zippa **innehållet** i `dist/` (så att `index.html` ligger i roten av zip-filen).
3. Ladda upp zip-filen i CrazyGames Developer Portal som HTML5-spel.

Spelet känner själv av när det körs på CrazyGames och laddar då CrazyGames SDK v3:
`loadingStart/Stop`, `gameplayStart/Stop`, `happytime` vid legendariska drops, belönade
annonser (Luck x3, 2x Coins, dubbla offline-pengar) och midgame-annonser vid zonbyten
(max var tredje minut). Ljudet och spelet pausas under annonser. Utanför CrazyGames körs
spelet utan SDK, och boost-knapparna är då gratis med nedkylning. Du kan testa SDK-läget
lokalt med `?sdk=crazygames`.

## Struktur

```
src/
  core/     ekonomi, sparning, ljud, input, portal-SDK
  data/     vapen, rariteter, monster, zoner, uppgraderingar
  gfx/      modell-kit och procedurella 3D-modeller
  game/     värld, zombies, vapen, projektiler, låda, reveal, vågor, spelloop
  ui/       HUD, menyer, 2D-overlay, ikoner, CSS
tools/      balanssimulering och testskript för skärmdumpar
```
