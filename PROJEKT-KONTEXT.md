# 🌷 Drömgården — projektkontext (läs denna för att fortsätta)

> **Till Claude:** Läs hela den här filen först när Carl öppnar workspacet och vill
> jobba vidare på Drömgården. Den innehåller allt du behöver för att fortsätta utan
> att fråga om grunderna. Uppdatera filen när något viktigt ändras.

Ett **co-op farming-spel** i webbläsaren för hela familjen (mest mobil). Odla, sköt
djur, driv gården tillsammans via rumskod. Del av familjens spelsamling på 8bitcat.

---

## 🔗 Alla artefakter / länkar

| Vad | Var |
|---|---|
| **Spela (live)** | https://8bitcat.github.io/dromgarden/ |
| **Alltid senaste (cache-fri)** | https://8bitcat.github.io/dromgarden/latest.html |
| **GitHub-repo** | https://github.com/8bitcat/dromgarden |
| **Lokal projektmapp** | `D:\GamesProjects\dromgarden` (desktop-genväg: "Drömgården - spelprojekt") |
| **Sprite-källor** | `D:\GamesProjects\dromgarden\_sprites\` (gitignorerat; desktop-genväg finns) |
| **Version nu** | **v13** (visas i spelets nedre högra hörn) |

---

## 🗂️ Filstruktur

```
index.html          skal, HUD, meny, CSS, versionsstämpel, "Spela senaste"-knapp
latest.html         redirect → ?t=<timestamp> (tvingar färsk version, kringgår cache)
js/game.js          spelloop, spelare, djur, verktyg, render, nät-glue, VERSION-konstant
js/world.js         enhetlig kartmodell (ground/solid/farm/objects/plots) + rendering + autotiles
js/prefabs.js       färdiga byggbitar + färdiga mysiga kartor + captureRegion/stampData
js/editor.js        kartbyggaren (palett, verktyg, spara/ladda, egna bitar)
js/brushes.js       skär alla sprite-ark i 16×16-celler → palett
js/assets.js        laddar sprite-ark, ritar figurer/djur, blit-hjälpare
js/net.js           PeerJS co-op (host-auktoritativ, 4-teckens rumskod)
js/ui.js            DOM: meny, HUD, butik, säljpanel, kartlista, toasts
js/input.js         tangentbord + touch-joystick + actionknapp
assets/*.png        sprites SPELET ANVÄNDER (kopierade från _sprites/, committade)
_sprites/           KÄLLpaketen vi bygger av (gitignorerat, lokalt):
   Tiny Wonder Farm/   (uppackat i _extracted/farm + _extracted/forest)
   Little dreamyland/  (ko + höns)
```

## 🎨 Sprite-källor & nyckelkoordinater (farm_tiles.png, 16px)

- **Terräng:** Tiny Wonder Farm `spring farm tilemap.png`. Gräs = (3,1).
- **Grusgång:** brun jord-tile (6,16).
- **Åker-autotile (RÄTT, låst):** kol **5-7 rad 11-13**. Äkta center = **(6,12)** (100% jord;
  använd EJ 5,12 som har border). t(6,11) b(6,13) l(5,12) r(7,12) tl(5,11) tr(7,11) bl(5,13) br(7,13).
  single(1,13). Sömlöst i alla storlekar. Vått = mörkare overlay på MITTEN (inte kanten).
  ⚠️ Fallgrop: "gräskanten" på jord-tiles är TRANSPARENS (gräs syns igenom).
- **Vatten-autotile:** kol 2-4 rad 7-9, center (3,8).
- **Grödor:** `plants free.png` — rad = gröda, kol 1-4 = 4 stadier, kol 0 = skörd-ikon.
  morot=rad1, potatis=2, sallad=5, jordgubbe=3, pumpa=0.
- **Objekt (`farm objects free.png`):** hus (0,96,80,95), **träd (48,0,32,60)** ⚠️ beskär till 60!
  (trädkolumnen är träd y0-60 + separat dekor y64+ → 64/80 klistrar fast dekor = "halva träd").
  Staket h(1,0) v(0,1), låda (16,64), dekor: tulip(3,4) white(2,4) rock(2,5) clover(3,5).
- **Djur:** ko + höns från Little Dreamyland (48×48, 4 rader: 0=upp 1=höger 2=vänster 3=ner).
  ⚠️ Fötterna sitter vid y31/48≈0.65 → drawAnimalSprite förankrar vid **0.65** (ej 0.9, då svävar de).
- **Karaktär:** `walk and idle.png` 24×24, bara framåtvy (rad 0=idle 4f, rad 1=gång 8f), speglas i sidled.
- **Mjölk-ikon:** farm_items (0,2)=(0,32). Ägg ritas i pixelkod.

## 🕹️ Spelmekanik

- Verktyg: ⛏️ hacka (gräs→åker, kräver farm-flagga) · 💧 vattna (2× tillväxt) · 🌱 så ·
  🧺 skörda · ✋ klappa (samla ägg/mjölk). Gå nära redo djur + gröna knappen = samla (valfritt verktyg).
- Delat (host-auktoritativt): coins, seeds, produce, dag/tid. Grödor växer 4 steg.
- Start kl 08:00 (natt-overlay dagtid 07-19 = ingen hinna; annars blev det grå film).

## 🏗️ Kartbyggare & prefabs

- Meny → "🎨 Bygg egen karta". Palett = alla ark (20 kategorier) + 🐮 Djur + 🏗️ Färdiga bitar + ⭐ Mina bitar.
- **Färdiga bitar** (prefabs.js PREFABS): Torp, Åker+staket, Tom åker, Djurgård, Damm, Blomrabatt, Träddunge, Stenar.
- **Egna bitar:** ⬚ Markera-verktyg → ⭐ Spara bit (captureRegion → localStorage `dromgarden-prefabs`) → återanvänd.
- **Färdiga kartor** (prefabs.js MAPS): Mysgården (`#cozy`), Ängsgården (`#meadow`) — i menyns kartlista + editorns Ladda.
- Sparade kartor: localStorage `dromgarden-maps`. Egna kartor kan hostas → skickas via world.snapshot().
- ⚠️ Björken används bara som tät kantskog (gles stam ser "halv" ut solo). Mysigt byggs med byggnader/fält/staket/dekor.

## 🚀 Deploy-workflow (VIKTIGT)

1. Ändra kod → `cd D:\GamesProjects\dromgarden`.
2. **Bumpa version** (annars ser familjen cachad gammal grafik!):
   - `sed -i "s/const VERSION = 'vN'/const VERSION = 'vN+1'/" js/game.js`
   - `python tools/bump.py N+1` — lägger `?v=N+1` på ALLA imports + index.html-entry.
3. `git add -A && git commit -m "..." && git push` → GitHub Pages bygger automatiskt (~1 min).
4. Verifiera live: `curl -s https://8bitcat.github.io/dromgarden/index.html | grep -o "game.js?v=[0-9]*"`.
5. Cache: mobil-webbläsare cachar hårt. Använd `latest.html` eller "🔄 Spela senaste version"-knappen.

## 🧪 Testa lokalt

```bash
cd D:/GamesProjects/dromgarden
python -m http.server 8791 --bind 127.0.0.1 &   # → http://127.0.0.1:8791/
# Playwright finns i d:/Qisy/QISYFrontend/QISYFrontend-1/node_modules — importera via createRequire.
# Röktest: goto → fyll #nameInput → klicka #btnSolo → window.__game exponerar allt.
```
Syntax: `node --input-type=module --check < js/fil.js`.

## ✅ Gjort · 💡 Idéer framåt

- Gjort: co-op, odling, djur (ägg/mjölk), butik/sälj, dag/natt, kartbyggare, prefabs, egna bitar,
  2 mysiga kartor, korrekt åker-autotile, hela träd, jordade djur, versionsstämpel + cache-fix.
- Idéer: fler prefabs (brunn, marknadsstånd, grind-varianter), fler mysiga kartor, spara gård i
  localStorage (host), skogens svamp-varelser som djur, årstider (forest-arken har sommar/höst/vinter),
  cat-kigurumi-skin, egna djurtyper i editorn.

## 🧭 Konventioner

- Git-remote = 8bitcat (gh authad). Commit-body förklarar VARFÖR. Co-Authored-By: Claude.
- Deterministisk kartgenerering (seed 20250723). Allt JSON-vänligt (localStorage + co-op-snapshot).
