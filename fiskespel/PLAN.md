# Fiskespel – analys av Fisch och plan för en webbversion

Skriven 2026-09-28. Underlaget kommer från sökresultat: wiki-sammanfattningar, guider och nyheter.
Fischipedia, Roblox, Rolimons och CrazyGames kunde inte öppnas direkt (blockerade i miljön),
så kontrollera siffrorna innan de används för något viktigt.

Planen är skriven för att bli ett **eget** spel, inte en kopia. CrazyGames avvisar kloner
och asset flips, men spelmekanik är inte upphovsrättsskyddad. Vi tar alltså mekaniken och
gör egna namn, egen grafik, egna fiskar och egna siffror.

---

## Del 1 – Analys av Fisch

### 1.1 Fakta

| | |
|---|---|
| Utvecklare | WoozyNate (Nate), ensam. Byggde spelet på ungefär 4 månader |
| Släppt | 5 oktober 2024 |
| Genombrott | Today's Picks och Robloxs X-konto 4 nov 2024. #1 i CCU 30 nov 2024, med 100K+ fler spelare än Blox Fruits |
| Ägarbyten | Fisching-gruppen och DoBig Studios (nov 2024). DoBig klev av 7 juli 2025. Nate tog tillbaka gruppen 21 aug 2025 |
| Topp | Över 1 M samtidiga spelare (rapporterat 4 okt 2025) |
| Visits | Ca 4,6 miljarder (juni 2026). 3,5 M favoriter. Ca 89–90 % positivt betyg |
| Nuläge | Ca 71K CCU (juni 2026). Någon färsk septembersiffra hittades inte |
| Senaste stora uppdatering | Tidefall, 17 jan 2026 (undervattenskarta och nya fiskar) |
| Inspiration | Mysigt fiske i stil med Stardew Valley |

### 1.2 Kärnloopen

```
 Kasta ──> Vänta + "shake" ──> Drillspel ──> FÅNGST (art × vikt × mutation)
   ^                                              │
   │                                              v
 Nya platser / väder / tid  <── Bättre spö/bete <── Sälj · Värdera · Bestiary · Quests
```

Varje kast tar några sekunder och slutar med en slumpad belöning. Pengarna går till
utrustning, som öppnar nya platser och bättre odds, och sedan börjar loopen om.

### 1.3 Systemen i detalj

**Fisket (tre faser)**
- **Kast:** håll och släpp. En kraftmätare avgör hur långt kastet går.
- **Shake:** knappar dyker upp på skärmen. Varje klick minskar väntan på napp med ca 0,5 s.
  Hög *lure speed* minskar behovet av att skaka.
- **Drillspelet:** håll nere så accelererar den vita stapeln åt höger, släpp så glider den
  åt vänster. Fisken ska hållas inne i stapeln.
  - Progressen går upp eller ner med **12 % per sekund** beroende på om fisken är inne eller ute.
  - De första **1,2 s** går det inte att ge input (eller tills progressen når 20 %).
  - **Perfect catch** betyder att fisken aldrig lämnade stapeln. Det ger 10 C$ och **1,5× XP**.
  - Fiskens rörelse: varje frame slumpas ett intervall på 2–5,1 × fiskens *resilience*.
    I snitt blir det ca 2,15 × resilience mellan rörelserna. Ovanligare fiskar har lägre
    resilience, så de rör sig oftare, och vissa sänker dessutom progresstakten.

**Spönas stats**

| Stat | Effekt |
|---|---|
| Lure Speed | Hur snabbt fisken nappar |
| Luck | Chansen till ovanligare fisk. *Universal* gäller alla fiskar, *preferred* gäller vissa arter |
| Control | Hur bred stapeln är i drillspelet |
| Resilience | Hur lite och hur sällan fisken rör sig |
| Max kg | Den tyngsta fisk spöt klarar |

Exempel på progression: Flimsy (startspö) → Carbon, 2 000 C$ (−10 % lure, +25 % luck,
0,05 control, 10 % res, 600 kg) → Steady, 7 000 C$ (−60 lure, +30 % res, 250 000 kg) →
Reinforced, 20 000 C$ (obegränsad vikt) → endgame, t.ex. Wingripper (222 % lure och luck).
Totalt finns över 100 spön.

**Bete**
- Förbrukningsvara som påverkar lure, universal luck, preferred luck och resilience.
- Preferred luck multiplicerar chansen för vissa arter, t.ex. 1 % × 300 % = 3 %.
- Beten har avvägningar: vissa ger mycket tur men långsammare napp.
- En låda kostar 120 C$ och innehåller 5 beten. Det finns ca 62–65 beten.

**Rariteter**
- Fiskarna har 18 rariteter. Huvudstegen är Trash → Common → Uncommon → Unusual → Rare →
  Legendary → Mythical → Exotic → Secret, och därefter specialnivåer.
- Det finns hundratals fiskar, till exempel 152 common, 160 rare och 120 mythical.
- Högre rariteter har egen napp-indikator och eget ljud. Det bygger mycket spänning.

**Fiskens värde**
- `Pris = ⌈ ⌈pris/kg × vikt⌉ × mutation × attribut ⌉`
- *Big* betyder över basvikten och *Giant* över 1,99 × basvikten. De är bara etiketter,
  det är vikten som ger värdet.
- En fisk kan ha högst en mutation. Över 190 mutationer finns, från Albino (1,2×) till Aether (12×).
- Attributen Shiny (1,85×) och Sparkling (1,85×) staplas ovanpå mutationen.
- Appraisern slumpar om vikt och mutation för 30 % av fiskens pris, men tar inte bort Shiny eller Sparkling.

**Tid, väder och säsong**
- Ett dygn är ca 25 min (1 s = 1 spelminut).
- Utanför sin tid på dygnet har en fisk **−90 %** chans.
- En säsong varar 576 min (ca 9,6 h). Rätt säsong ger **+25 %**, fel säsong ger **−15 %**.
- Vädret slumpas vid varje dag och natt. Rätt väder ger **+35 %**.
- Serverevent och *totems* kan ändra tid och väder.

**Progression**
- XP kommer från fångster, kistor (1 500–2 000), Angler-quests (6–8 × fiskens bas-XP),
  nya platser (300) och avklarade bestiary-sidor.
- XP till nästa nivå är **190 × nivå** (dubblas var 500:e nivå efter 1001). Max är nivå 2000.
- En bestiary per plats ger C$, XP och en kosmetisk bobber. 100 % ger en unik belöning.

**Övriga system**
- Enchants: reliker används vid ett altare som är öppet på natten. De ger stats,
  mutationschans eller förmågor. Det finns ca 64 enchants.
- Skattkarta: 1/200 chans per fångst, leder till en kista.
- 9 Angler-NPC:er med oändliga quests (2 min cooldown).
- Totems, båtar och 27+ platser.

**Monetisering (Roblox)**
- Gamepasses för 99–499 Robux, t.ex. Appraiser's Luck 299, Sell Anywhere 399,
  Appraise Anywhere 499 och Double XP 239.
- Tidsbegränsade tur-boosts och x2–x4 money-pass. Det är de som ledde till P2W-kritiken.

### 1.4 Varför Fisch höll kvar spelarna

1. **Tre oberoende slumplager per fångst** (art × vikt × mutation/attribut). Varje kast
   *kan* bli en jackpot, vilket är klassisk variabel belöning.
2. **Skicklighet plus tur.** Drillspelet gör att fångsten känns förtjänad, och perfect
   catch belönar skickliga spelare.
3. **Samlande.** Bestiaryn per plats ger tydliga mål med belöningar.
4. **Knapphet i tid.** Vissa fiskar finns bara vid viss tid, väder eller säsong, så det
   finns alltid ett skäl att komma tillbaka.
5. **Mysig ton och utforskning.** Nya öar känns som en belöning i sig.
6. **Långa mål:** 2 000 nivåer, 100+ spön och enchants.
7. **Socialt:** man ser andras fångster, och serverevent händer för alla samtidigt.

### 1.5 Varför Fisch tappade, och vad *Fish It!* visade

- Efter ägarbytet kom aggressiv monetisering. Spelarna kritiserade det och spelarbasen
  föll (enligt flera källor).
- Mängden system gör tröskeln hög för yngre spelare.
- **Fish It!** kom 2025 och är en förenklad kopia av Fisch. Den nådde **2,7 M CCU**
  (#6 genom tiderna på Roblox), mot Fischs ca 1 M. Idag har den 78K–130K CCU,
  4,6–4,8 miljarder visits och 83 % betyg. Förenklingarna var:
  - Man klickar för att fylla en stapel i stället för att styra den
  - Utrustning väljs automatiskt och bobbers tar aldrig slut
  - Oddsen visas som **"1 på X"**, vilket är lätt för barn att förstå
  - Inbyggt AFK-fiske, som ger ca 30 min snittsession

**Lärdom:** behåll Fischs djup i slumplagren och samlandet, men gör starten enkel,
visa oddsen tydligt och håll monetiseringen snäll.

### 1.6 Konkurrens på CrazyGames (rättelse)

I förra svaret skrev jag att bara *Crazy Fish* fanns. **Det var fel.** Med samma sorts
loop (fånga, sälja, uppgradera, nya platser) finns bland annat:

- **Fish It Now**: bättre spön och flöten, båt, nya öar
- **Big Catch**: rariteter, spöuppgraderingar, nya platser med båt
- **Fishing Anomaly**: muterade fiskar, 100+ arter, 10 platser
- **Fish Orbit**, **Crazy Fish** (multiplayer), **Cozy Fishing**, **Idle Fishing**,
  **Tiny Fishing**, **Fishing Clicker 3D**, **Real Fishing Simulator**

Betyg och spelantal gick inte att se. **Nischen är alltså inte tom och spelet måste
sticka ut.** Spela de fyra första i ca 10 minuter var innan du börjar bygga.

---

## Del 2 – Vårt spel

### 2.1 Koncept

**Arbetsnamn:** *Reel Isles*. Kontrollera att namnet är ledigt innan lansering.

Ett lågpoly-3D-spel med öar, tredjepersonskamera och mysig ton.

**Pitch:** "Fånga dussintals fiskar i en värld där väder och tid är gemensamma för alla
spelare. Varje kast kan bli en glödande jättefisk."

**Det som skiljer oss från CrazyGames-konkurrenterna:**
1. **Ett riktigt drillspel** med skicklighet (från Fisch), plus valfri auto-drill (från Fish It!).
2. **Tre slumplager med en stor reveal-stund.** Skärmen visar t.ex. "1 på 2 400", viktrekord och mutationseffekt.
3. **Global klocka.** Dygn, väder och event räknas från UTC-tid, så alla spelare har
   samma "Blodmåne om 42 min" utan någon server. Det ger skäl att komma tillbaka.
4. **Bestiary med silhuetter,** bästa vikt per art och vilka mutationer man sett.

**Det vi inte tar:** namnet Fisch, platsnamn (Moosewood, Roslit…), fisk- och
spönamn, grafik, UI-layout och ljud.

### 2.2 Anpassningar för webben

| Fisch (Roblox) | Vårt spel | Varför |
|---|---|---|
| Servrar med ca 20 spelare | Singleplayer med global UTC-klocka | Ingen backend behövs, men världen känns delad |
| Dygn på 25 min | Dygn på 16 min (8 dag + 8 natt) | Webbsessioner är kortare, och spelaren ska hinna se både dag och natt |
| Säsong på 9,6 h | En säsong per UTC-dygn, i rotation | Skäl att komma tillbaka imorgon |
| 100+ spön | 5 (MVP), 12 (v1) | Hålla scopet |
| Hundratals fiskar | 30 (MVP), 70 (v1) | Hålla scopet |
| Gamepasses | Frivilliga rewarded ads, aldrig betalvägg | Så tjänar CrazyGames-spel pengar, och vi undviker Fischs P2W-miss |
| AFK på servern | Auto-drill plus "medan du var borta"-beräkning | Webbläsare pausar flikar i bakgrunden |
| Handel | Ingen | Inte möjligt utan backend |

### 2.3 Omfattning

**MVP (Basic Launch)**
- 1 ö med 3 fiskezoner: *Bryggan*, *Lagunen* och *Klippkanten*
- 30 fiskar i 7 rariteter
- 5 spön och 3 beten
- Kast, shake och drillspel
- Vikt, 5 mutationer och 2 attribut
- Dygn, 4 väder (klart, regn, dimma, storm) och 1 globalt event (*Blodmåne*)
- Ryggsäck med tak, sälj och butik
- Bestiary per zon med belöning
- Nivåer och XP som låser upp zoner och spön
- Sparning via CrazyGames SDK, med localStorage som reserv
- 3 typer av rewarded ads, samt midgame-ads vid naturliga pauser
- Kontroller för dator och mobil
- En tutorial på under 60 s

**v1.0 (Full Launch)**
- 2 öar till, som nås med båt
- 70 fiskar, 12 spön och 8 beten
- Värderare (slumpar om vikt och mutation mot avgift)
- Quests à la Angler
- Säsonger och 3 globala event
- Legendariska boss-fiskar med ett drillspel i flera faser
- Auto-drill och dagliga uppdrag

**v1.x (live ops)**
- En ny ö per månad och eventfiskar
- Enchant-system
- Topplista över viktrekord, om SDK:n stöder det
- Kosmetiska köp

### 2.4 Speldesign med siffror (startvärden, justeras med simulatorn i 2.6)

**Rariteter**

| Raritet | Basvikt i poolen | Luck-faktor k | Färg | Exempelpris |
|---|---|---|---|---|
| Skräp | 8 | −0,5 | grå | 1–5 |
| Vanlig | 55 | 0 | vit | 5–20 |
| Ovanlig | 24 | 0,3 | grön | 20–60 |
| Sällsynt | 9 | 0,7 | blå | 60–200 |
| Episk | 3 | 1,2 | lila | 200–700 |
| Legendarisk | 0,9 | 1,8 | guld | 1 000–4 000 |
| Mytisk | 0,1 | 2,5 | rosa, glödande | 8 000–30 000 |

Chansen för en fisk räknas ut så här:

```
vikt = basvikt × (1 + luck × k)             (golv på 0)
     × 0,1   om fel tid på dygnet
     × 1,35  om rätt väder
     × 1,25 / 0,85   rätt / fel säsong      (v1)
     × (1 + preferredLuck)   om betet föredras
Eventfiskar finns bara när eventet är aktivt.
"1 på X" = summa av alla vikter / fiskens vikt   → visas i bestiaryn och vid fångst
```

**Vikt**
- Varje fisk har `minKg`, `maxKg` och `prisPerKg`.
- Vikten slumpas som `kg = min + (max − min) × u^2`, alltså oftare lätta fiskar.
- *Stor* betyder att fisken är över 75:e percentilen och *Jätte* över 97:e. Båda är bara etiketter.
- Är fisken tyngre än spöts max-kg går progressen i drillspelet på halvfart och en varningsikon visas.
  Linan brister inte, eftersom det bara är frustrerande.

**Mutationer (egna namn och värden)**

| Mutation | Multiplikator | Villkor | Chans |
|---|---|---|---|
| Albino | 1,3× | alltid | 3 % |
| Glödande | 2× | natt | 2 % |
| Stormladdad | 2,5× | storm | 4 % |
| Gyllene | 4× | alltid | 0,5 % |
| Blodmåne | 6× | under eventet | 8 % |

Högst en mutation per fisk. Attributen **Glans (1,5×)** och **Gnistor (1,5×)** slumpas
var för sig med 2 % chans vardera och staplas.

`värde = ceil( ceil(prisPerKg × kg) × mutation × attribut1 × attribut2 )`

**Tempo per kast**
- Kastet tar ca 1 s.
- Väntan på napp är `slump(4, 9) s × (1 − lure)`, minst 1 s. Varje shake-klick drar av 0,5 s.
- Drillen tar 4–12 s.
- I början blir det alltså ca 12–20 s per fisk.

**Drillspelet (normaliserad bana 0–1)**
- Stapelns bredd är `0,20 + spö.control`.
- Håll = +3,0/s² acceleration, släpp = −3,0/s². Maxfart 1,2/s. Studs mot kanterna med faktor 0,3.
- Fisken siktar mot slumpade mål. Ett nytt mål väljs efter `slump(2; 5,1) × fisk.lugn × (1 + spö.resilience)` s.
- Progressen börjar på 20 %. Den ökar med +14 %/s när fisken är inne och minskar med −10 %/s ute.
  Under första sekunden kan fisken inte fly.
- Legendarisk och Mytisk: progressen går på ×0,75 och fisken gör rusningar.
- 100 % är fångst och 0 % betyder att fisken flyr. Perfekt fångst ger **+50 % XP** och en "Perfekt!"-text.
- Om fisken flyr kan spelaren titta på en rewarded ad, "Håll kvar fisken", och försöka igen.

**Spön (MVP)**

| Spö | Pris | Nivå | Lure | Luck | Control | Resilience | Max kg | Special |
|---|---|---|---|---|---|---|---|---|
| Pinne | 0 | 1 | 0 % | 0 % | 0,00 | 0 % | 20 | – |
| Bambu | 250 | 2 | +10 % | +10 % | 0,03 | 0 % | 60 | – |
| Glasfiber | 1 500 | 6 | +15 % | +25 % | 0,05 | +10 % | 200 | – |
| Tungdrag | 6 000 | 12 | −20 % | +20 % | 0,08 | +35 % | 2 000 | för stora fiskar |
| Stjärnspö | 20 000 | 20 | +30 % | +70 % | 0,06 | +10 % | 800 | mutationschans ×1,5 |

**Beten (MVP)**
- **Mask**: billig, +10 % lure
- **Räka**: +30 % luck, −10 % lure
- **Glödbete**: nattfiskar +200 % (preferred)

**XP och nivåer**
- XP till nästa nivå: `50 + 25 × nivå`.
- XP per fångst efter raritet: 5 / 10 / 20 / 45 / 100 / 300 / 1 000.
  Perfekt fångst ger ×1,5 och en ny art ger ×3.
- Lagunen låses upp på nivå 5 och Klippkanten på nivå 12.

**Målkurva för de första minuterna**

| Tid | Händelse |
|---|---|
| 0:10 | Första fisken |
| 0:45 | Första försäljningen (i tutorialen) |
| ca 3 min | Bambuspöet |
| ca 10 min | Nivå 5 och Lagunen |
| ca 15 min | Första episka fisken |
| ca 30 min | Glasfiberspöet |
| Session 2–3 | Tungdrag eller Stjärnspö, Bryggans bestiary klar |

**Ryggsäck, butik och bestiary**
- Ryggsäcken har 20 platser och kan uppgraderas till 40 och 80 för mynt. Taket tvingar spelaren att sälja.
- Fiskar kan favoritmarkeras. "Sälj allt" säljer alla utom favoriterna.
- Bestiaryn visar okända fiskar som silhuetter. Efter fångst visas "1 på X", bästa kg och sedda mutationer.
- En klar zon ger mynt, XP och en bobber-skin. HUD:en visar samlarprocenten.

**Global klocka**

```ts
const EPOCH = Date.UTC(2026, 0, 1);
const HALV_CYKEL_MS = 8 * 60 * 1000;              // 8 min dag, 8 min natt
const t = Date.now() - EPOCH;
const halvcykel = Math.floor(t / HALV_CYKEL_MS);  // varje dag och natt får ett eget index
const ärNatt = halvcykel % 2 === 1;
const väder = väljVäder(hash(halvcykel));         // samma för alla spelare
const blodmåne = ärNatt && hash(halvcykel) % 6 === 0;   // ungefär varannan timme
const säsong = SÄSONGER[Math.floor(t / 86_400_000) % 4];  // (v1)
```

Eftersom allt är deterministiskt kan HUD:en räkna fram nästa event och visa en nedräkning.
Att fuska med datorns klocka spelar ingen roll i ett singleplayer-spel.

### 2.5 Monetisering och CrazyGames SDK

**Rewarded ads (spelaren väljer själv)**
1. Tur ×2 i 5 min
2. Sälj för ×2, en gång per 10 min
3. Håll kvar fisken när den flyr
4. Gratis betespaket

**Midgame-ads (bara vid naturliga pauser)**
- Visas när butiken stängs, efter en bestiary-belöning eller vid byte av zon.
- Visas **aldrig** under drillspelet eller fångstens reveal.
- SDK:n styr själv hur ofta de visas.

**Signaler till SDK:n**
- `loadingStart`/`loadingStop` runt laddningen.
- `gameplayStart` när spelaren kan röra sig.
- `gameplayStop` vid meny, paus och annons.
- `happytime` vid legendarisk eller bättre fångst.

**Kosmetiska köp (senare):** bobbers och spö-skins. Aldrig köp som påverkar tur eller
pengar, det var Fischs misstag.

**Intäkter:** CrazyGames jam-villkor 2026 anger att utvecklaren får 60 % av annonsintäkterna
och 70 % av köpen. En utvecklare rapporterade ca 1,20 € per 1 000 spelningar. Det är en
enstaka datapunkt, ingen garanti.

**Tekniska krav (hämtade från sökresultat, verifiera i dokumentationen)**
- Initial nedladdning högst 50 MB. För att synas på mobilstartsidan gäller högst 20 MB.
- Totalt högst 250 MB och under 1 500 filer.
- Spelet måste gå bra på en Chromebook med 4 GB RAM.
- Initial nedladdning mäts fram till första `gameplayStart`. Ladda därför bara Bryggan,
  spelaren och vattnet först, och resten i bakgrunden.
- **Vårt mål: under 8 MB initialt.**

**SDK-skiss** (v3; kontrollera namnen mot docs.crazygames.com innan du kodar):

```ts
const sdk = window.CrazyGames?.SDK;
await sdk.init();
sdk.game.loadingStart();
// ...ladda Bryggan...
sdk.game.loadingStop();
sdk.game.gameplayStart();

function visaRewarded(belöning: () => void) {
  sdk.ad.requestAd('rewarded', {
    adStarted: () => { pausaLjud(); sdk.game.gameplayStop(); },
    adFinished: () => { belöning(); återuppta(); sdk.game.gameplayStart(); },
    adError: () => { återuppta(); /* ingen belöning */ },
  });
}

sdk.data.setItem('save', JSON.stringify(spardata)); // localStorage som reserv
```

### 2.6 Teknik

**Stack**
- **Vite + TypeScript + Three.js**, UI i vanlig HTML/CSS och ljud via Web Audio.
- Tester med **Vitest**.
- Modeller komprimeras med **gltf-transform** (meshopt/Draco, KTX2).
- Grafik bara från CC0-paket (Kenney, Quaternius) eller egen. Varje källa loggas i `CREDITS.md`.
- **Inte Unity:** WebGL-byggen blir stora och laddar långsamt, och initial-gränsen på 20 MB för mobil är svår att klara.
- **Ingen fysikmotor:** en enkel kapsel och raycast mot marken räcker. Båten styrs kinematiskt.

**Grafik och prestanda**
- **Vatten:** ett plan med vågor i vertex-shadern och fresnel. Skum vid stranden kommer från en förbakad mask.
- **Himmel:** gradient-shader som styrs av den globala klockan, plus dimma.
- **Fiskar:** 5–6 grundmodeller (liten, lång, platt, rund, ål, haj). Färg och skala ger 30 arter.
- **Mutationer:** shader-parametrar (emissive, kantglöd) och partiklar. Det kostar nästan inga megabyte.
- **Budget:** högst 100 draw calls och 200k trianglar, texturer högst 1024², instancing
  för vegetation, pixel ratio max 1,5 och automatisk kvalitetsnivå efter FPS.

**Struktur**

```
fiskespel/
  PLAN.md
  index.html  package.json  vite.config.ts  tsconfig.json
  src/
    main.ts                 start, SDK, spel-loop
    core/    loop.ts input.ts save.ts sdk.ts rng.ts clock.ts audio.ts
    world/   scene.ts water.ts sky.ts island.ts player.ts camera.ts zones.ts
    fishing/ cast.ts bite.ts reel.ts roll.ts value.ts
    game/    inventory.ts shop.ts bestiary.ts progression.ts boosts.ts
    ui/      hud.ts reelUI.ts catchReveal.ts shopUI.ts bestiaryUI.ts toast.ts
    data/    fish.ts rods.ts baits.ts mutations.ts zones.ts
  tests/     roll.test.ts value.test.ts economy.sim.ts
  public/assets/  models/ audio/ textures/
```

**Principer**
- All spellogik är rena TypeScript-funktioner utan Three.js. Då går den att testa,
  och `economy.sim.ts` kan simulera tusentals timmars fiske för att balansera priser och XP.
- Fisket är en tillståndsmaskin:
  `Idle → Siktar → Kastar → Väntar(shake) → Napp → Drill → Fångad/Flydd → Reveal → Idle`
- Allt innehåll är data. En ny fisk är en rad till i `fish.ts`.

**Exempel på data och kärnlogik**

```ts
// data/fish.ts
export const FISH: FishDef[] = [
  { id: 'bryggabborre', namn: 'Bryggabborre', zon: 'bryggan', raritet: 'vanlig',
    basvikt: 10, tid: 'alla', väder: null, minKg: 0.2, maxKg: 1.8, prisPerKg: 12,
    lugn: 1.0, modell: 'rund', färg: '#6a8f3c' },
  // ...
];

// fishing/roll.ts
export function rollFish(pool: FishDef[], ctx: RollCtx, rng: Rng): { fisk: FishDef; odds: number } {
  const vikter = pool.map(f => chansvikt(f, ctx));
  const summa = vikter.reduce((a, b) => a + b, 0);
  let r = rng() * summa;
  for (let i = 0; i < pool.length; i++) {
    r -= vikter[i];
    if (r <= 0) return { fisk: pool[i], odds: summa / vikter[i] }; // "1 på X"
  }
  return { fisk: pool[pool.length - 1], odds: summa / vikter[pool.length - 1] };
}

function chansvikt(f: FishDef, ctx: RollCtx): number {
  if (f.event && f.event !== ctx.aktivtEvent) return 0;
  let w = f.basvikt * Math.max(0, 1 + ctx.luck * LUCK_K[f.raritet]);
  if (f.tid !== 'alla' && f.tid !== ctx.tid) w *= 0.1;
  if (f.väder && f.väder === ctx.väder) w *= 1.35;
  if (ctx.bete?.föredrar?.(f)) w *= 1 + ctx.bete.preferredLuck;
  return w;
}

// fishing/value.ts
export function fiskvärde(f: FishDef, kg: number, mut: number, attr: number[]): number {
  const bas = Math.ceil(f.prisPerKg * kg);
  return Math.ceil(attr.reduce((v, m) => v * m, bas * mut));
}
```

### 2.7 Färdplan

Grov uppskattning för en person som jobbar på deltid.

| Vecka | Mål | Klart när |
|---|---|---|
| 1 | **Grund:** Vite/TS/Three, ö, vatten, himmel, spelare, kamera, dator- och mobilinput | Du kan gå runt på ön i mobil och dator i 60 fps |
| 2 | **Fiskeloopen:** kast, shake, drillspel, `rollFish`, vikt, mutationer, fångst-reveal | Fånga en fisk från början till slut och se "1 på X" |
| 3 | **Ekonomi och sparning:** ryggsäck, sälj, butik, spön, beten, XP, spardata | Spela, stäng, öppna och allt finns kvar |
| 4 | **Innehåll:** 30 fiskar, 3 zoner, global klocka, 4 väder, Blodmåne, bestiary | Hela MVP-innehållet går att spela, och simulatorn visar att målkurvan håller |
| 5 | **Känsla och prestanda:** ljud, partiklar, skakningar, tutorial, kvalitetsnivåer, laddning | En ny spelare fångar en fisk inom 15 s utan hjälp, och det går bra på en svag laptop |
| 6 | **SDK och lansering:** annonser, signaler, molnsparning, QA-lista, skärmdumpar, inskick | Inskickat till Basic Launch |
| 7–12 | **v1.0:** båt, 2 öar, 40 nya fiskar, värderare, quests, säsonger, boss-fiskar, auto-drill | Inskickat till Full Launch |

### 2.8 Risker

| Risk | Åtgärd |
|---|---|
| Avvisas som klon | Eget namn, egen grafik, egna fiskar och siffror, och den globala klockan som eget inslag |
| Genren finns redan på CrazyGames | Spela konkurrenterna först och satsa hårt på drillspelets känsla och fångst-reveal |
| 3D blir för stort | En ö i MVP och återanvända modeller. Ingen båt före v1 |
| Prestanda på mobil och Chromebook | Budget från dag 1, automatisk kvalitet och tester på svag hårdvara varje vecka |
| Ekonomin blir obalanserad | `economy.sim.ts` och målkurvan i 2.4 |
| Licensproblem med grafik | Bara CC0 eller egen grafik, loggat i `CREDITS.md` |
| Innehållet tar slut (live ops) | Allt är data, så en ny ö är till största delen nya rader och modellvarianter |

### 2.9 Vad du ska mäta

Det här är egna mål, inte branschsiffror:
- Andel spelare som fångar första fisken inom 15 s
- Andel som köper första spöet
- Andel som når Lagunen (nivå 5)
- Snittspeltid och D1 i CrazyGames developer dashboard

---

## Källor

- Fisch-fakta och tidslinje: [Roblox Wiki – Fisch](https://roblox.fandom.com/wiki/Fisching/Fisch), [Fischipedia – Fisch](https://fischipedia.org/wiki/Fisch), [DevForum Creator Spotlight](https://devforum.roblox.com/t/creator-spotlight-woozynate-makes-a-splash-with-fisch/3269481)
- Fiske och drillspel: [Fischipedia – Fishing](https://fischipedia.org/wiki/Fishing), [Fisch Wiki – Fishing](https://fisch.fandom.com/wiki/Fishing), [Fischipedia – Resilience](https://fischipedia.org/wiki/Resilience)
- Stats och spön: [Fisch Wiki – Stats](https://fisch.fandom.com/wiki/Stats), [Fisch Wiki – Fishing Rods](https://fisch.fandom.com/wiki/Fishing_Rods), [PCGamesN – rod tier list](https://www.pcgamesn.com/fisch/rod)
- Bete: [Fischipedia – Bait](https://fischipedia.org/wiki/Bait), [Fisch Wiki – Baits](https://fisch.fandom.com/wiki/Baits)
- Rariteter: [Fischipedia – Rarity](https://fischipedia.org/wiki/Rarity)
- Mutationer och värde: [Fischipedia – Mutations](https://fischipedia.org/wiki/Mutations), [Fischipedia – Fish](https://fischipedia.org/wiki/Fish), [Beebom – Appraisal](https://beebom.com/fisch-appraisal-guide/)
- Väder, tid och säsong: [Fischipedia – Weather and Events](https://fischipedia.org/wiki/Weather_and_Events), [Destructoid – seasons & weather](https://www.destructoid.com/complete-fisch-seasons-and-weather-guide/)
- Nivåer och bestiary: [Fischipedia – Level](https://fischipedia.org/wiki/Level), [Fischipedia – Bestiary](https://fischipedia.org/wiki/Bestiary)
- Enchants, quests, skatter: [Fischipedia – Enchanting](https://fischipedia.org/wiki/Enchanting), [Fischipedia – Angler](https://fischipedia.org/wiki/Angler), [Fischipedia – Treasure Hunting](https://fischipedia.org/wiki/Treasure_Hunting)
- Gamepasses: [Fisch Wiki – Gamepasses](https://fisch.fandom.com/wiki/Gamepasses)
- Fish It!: [MaxPowerGaming – simplified copycat](https://www.maxpowergaming.co/post/fish-it-how-a-simplified-copycat-became-one-of-roblox-s-biggest-hits), [GAMES.GG – Fish It rise](https://games.gg/news/fish-it-unexpected-rise-to-the-top-of-roblox/), [GameBoost – Fish It vs Fisch](https://gameboost.com/blog/fish-it-vs-fisch-roblox-comparison)
- Nuvarande spelarsiffror: [BloxQuiz – Fisch](https://www.bloxquiz.gg/stats/fisch), [LevelUpPlay – Fish It](https://levelupplay.my/game/fish-it)
- CrazyGames-krav och SDK: [Technical](https://docs.crazygames.com/requirements/technical/), [Quality](https://docs.crazygames.com/requirements/quality/), [Ads](https://docs.crazygames.com/requirements/ads/), [SDK – Game](https://docs.crazygames.com/sdk/game/), [SDK – Video ads](https://docs.crazygames.com/sdk/video-ads/), [Cinevva – publish guide](https://app.cinevva.com/guides/publish-game-crazygames)
- Konkurrenter på CrazyGames: [Fish It Now](https://www.crazygames.com/game/fish-it-now), [Big Catch](https://www.crazygames.com/game/big-catch), [Fishing Anomaly](https://www.crazygames.com/game/fishing-anomaly), [Fish Orbit](https://www.crazygames.com/game/fish-orbit), [Crazy Fish](https://www.crazygames.com/game/crazy-fish), [Fishing-taggen](https://www.crazygames.com/t/fishing)
