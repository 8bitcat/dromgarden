# 🌷 Drömgården

En mysig **co-op farming sim** i webbläsaren för hela familjen — byggd för att spelas
tillsammans, mest från **mobilen**. Odla grödor, sköt djuren och driv er gård ihop.

▶️ **Spela:** https://8bitcat.github.io/dromgarden

## Så spelar ni ihop

1. En i familjen trycker **🏡 Skapa gård** och får en **4-teckens kod**.
2. Alla andra skriver in koden och trycker **Gå med** — från valfri mobil/dator.
3. Ni delar samma gård, samma kassa och samma skörd i realtid.

Ingen server, ingen installation — co-op sker peer-to-peer via PeerJS (samma som
VILDMARKEN). Värdens webbläsare håller den "sanna" gården.

## Spelloop

- **⛏️ Hacka** gräs → uppluckrad jord
- **💧 Vattna** jorden (växer dubbelt så snabbt)
- **🌱 Så** ett frö (välj gröda i fröraden)
- vänta medan grödan växer i 4 steg ☀️
- **🧺 Skörda** den mogna grödan
- **📦 Sälj** skörden vid kistan → 🪙 mynt
- **🛒 Butik** för att köpa fler frön
- **✋ Klappa** djuren i hagen och samla 🥚 ägg / 🥛 mjölk

Grödor: 🥕 Morot · 🥔 Potatis · 🥬 Sallad · 🍓 Jordgubbe · 🎃 Pumpa.

## 🎨 Kartbyggare

Tryck **🎨 Bygg egen karta** i menyn för att göra en helt egen gård. Alla sprites
från Tiny Wonder Farm + Forest finns i paletten (gräs, mark, broar, växter, objekt,
möbler, årstider, m.m.).

- **🖌️ Måla** — välj en ruta i paletten och måla mark, eller placera träd/hus & djur
- **🧱 Vägg** — gör en ruta ogenomtränglig · **🌱 Åker** — markera var man får odla
- **🚩 Start** — sätt var man börjar · **🧽 Radera** · **✋ Flytta** — panorera (➕/➖ zoomar)
- **💾 Spara** / **📂 Ladda** — kartor sparas i webbläsaren
- **▶️ Spela** — testa kartan direkt

Sparade kartor dyker upp i menyns **🗺️ Karta**-lista — välj en och tryck *Skapa gård*
så spelar hela familjen på din egen karta (den skickas automatiskt till alla som ansluter).

## Styrning

| | Mobil | Dator |
|---|---|---|
| Gå | dra fingret var som helst (dynamisk joystick) | WASD / piltangenter |
| Använd verktyg | stora gröna knappen | Mellanslag / E |
| Byt verktyg | verktygsraden nere till vänster | 1–5 |

## Teknik

Ren vanilla JS + Canvas 2D, ES-moduler. Grafik från **Tiny Wonder Farm** — riktig
terräng-tilemap (gräs, vatten-autotile, uppluckrad/våt jord), grödor i 4 växtstadier,
färdigt torp, träd och staket. Djur (ko/höns) från Little Dreamyland. Co-op via
**PeerJS** (host-auktoritativ). Ligger på **GitHub Pages** — statisk sajt.

```
index.html         skal, HUD, meny, CSS
js/game.js         spelloop, spelare, verktyg, render, nät-glue
js/world.js        karta, tiles, grödor, rendering, serialisering
js/assets.js       sprite-ark (48×48, 4 riktningar)
js/net.js          PeerJS co-op
js/ui.js           menyer, butik, HUD, toasts
js/input.js        tangentbord + touch-joystick
assets/            sprite-PNG:er
```

Del av familjens spelsamling på [8bitcat.github.io](https://8bitcat.github.io).
