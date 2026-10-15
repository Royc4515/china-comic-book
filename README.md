# 📖 Roy's China Adventure: The Graphic Novel
> **A 12-Page Graphic Novel in Avatar: The Last Airbender Animation Comic Style**  
> *Fourteen days, four iconic cities, ancient wonders, and futuristic skylines.*

---

## 🧭 Project Overview

This project is a 12-page virtual comic book chronicling Roy's 14-day expedition through China with his friends **Jin** and **Mei**, and recurring historical guide **Lao Feng**.

* **Art Direction**: Dynamic cel-shaded animation comic art (*Avatar: The Last Airbender* aesthetic), clean black ink line art, multi-tier comic panels, speech balloons, and authentic sound effects.
* **Canvas Format**: Vertical 3:4 / 2:3 digital comic format (`896 × 1200` native high resolution).
* **Generation Engine**: Google Flow (`Nano Banana 2.1 🍌`) with persistent character model sheets.

---

## 📱 The Reader (`index.html`) — mobile-native

A left-to-right book that is built for phones first and scales up to tablets and desktop.

* **Touch**: the page follows your finger (hinged 3D page turn with dynamic shading), flick to complete, tap the right/left side to turn, tap the middle to hide/show menus, pinch or double-tap to zoom, pan when zoomed, swipe up for the chapter synopsis, drag sheets down to dismiss.
* **Sound** (all synthesised in the browser, no audio files): paper-turn foley that pans with the page direction, tick/tap UI sounds, a pentatonic chime, a gong on opening, and a per-chapter ambience (wind, city, train, candle, mist, jazz). Modes: off / effects / effects + ambience. iOS needs one tap to start audio, which the opening screen provides.
* **Music**: two real CC BY tracks (`assets/music/`, credits in `assets/music/CREDITS.md` and in Settings) that crossfade as the chapter mood changes; the synth pads step aside while music plays, leaving only wind/city/train texture. Switchable in Settings.
* **Haptics**: Vibration API on Android; the Safari `switch` haptic on iOS 17.4+ (iOS only allows it inside a tap/gesture handler).
* **Effects**: chapter-themed particles (snow on the Great Wall, lanterns in Xi'an, neon on the Bund…), accent colour per chapter, gyroscope/mouse tilt with a holographic foil on the cover. All respect `prefers-reduced-motion` and can be switched off in Settings.
* **App-like**: installable (PWA), works offline once visited, remembers your page, deep-links with `#5`, keeps the screen awake, handles notches/safe areas and landscape.
* **Modes**: page-flip or vertical scroll.

### Layout of the code

```text
index.html            markup only
css/base.css          tokens, stage, 3D leaves, effects layers
css/hud.css           top bar, dock, sheets, settings, splash, scroll mode
js/core.js            pure logic (gesture/zoom/flip maths) — unit tested
js/data.js            chapters, covers, per-chapter theme (accent / particles / ambience)
js/gestures.js        pointer-event recogniser (drag, pinch, tap, double-tap, wheel)
js/reader.js          the book: leaves, settle physics, zoom
js/audio-engine.js    Web Audio synthesis      js/audio.js  unlock + modes
js/fx.js              particles + tilt         js/haptics.js
js/ui.js, app.js      HUD, sheets, settings, wiring
sw.js, manifest.webmanifest   offline + install
```

### Commands

```bash
npm install            # one-off (installs sharp, used only to build images)
npm start              # dev server (PORT=3457 npm start to change the port) -> /index.html
npm run optimize       # rebuild assets/web/*.webp (+ thumbs, icons) from assets/*.png
npm test               # unit tests for js/core.js
```

The reader loads the optimised WebP copies in `assets/web/` (about 75% smaller than the originals). The review dashboard regenerates the matching WebP automatically whenever you pick a variant; if you replace images by hand, run `npm run optimize`.

---

## 📂 Project Directory Structure

```text
c:\Users\Roy\02_Dev\china-comic-book\
├── index.html                   # 🚀 Interactive Digital Comic Book Reader (Flipbook, Audio, Fullscreen)
├── review.html                  # 🔍 Side-by-Side Candidate Comparison & Selection Dashboard
├── serve-review.js              # ⚡ Lightweight Local Server (serves Reader and Review at :3456)
│
├── assets/                      # 🏆 Final Curated Comic Book Pages (Pages 01 to 12)
│   ├── page_01.png              # Chapter 1: The High Horizon (Beijing CBD Skyline Toast)
│   ├── page_02.png              # Chapter 2: Imperial to Avant-Garde (Forbidden City & 798 Art)
│   ├── page_03.png              # Chapter 3: The Dragon’s Crest (Mutianyu Great Wall & Toboggan)
│   ├── page_04.png              # Chapter 4: Sanctuary in the Capital (Shabbat in Chaoyang)
│   ├── page_05.png              # Chapter 5: Velocity of Steel (CR400 Bullet Train to Xi'an)
│   ├── page_06.png              # Chapter 6: Sunset Ramparts (Xi'an 14km Ancient Wall Cycling)
│   ├── page_07.png              # Chapter 7: The Silent Legion (Terracotta Warriors & Muslim Quarter)
│   ├── page_08.png              # Chapter 8: The Sky Elevator (Zhangjiajie Bailong 326m Elevator)
│   ├── page_09.png              # Chapter 9: The Floating Monoliths (Avatar Hallelujah Mountain)
│   ├── page_10.png              # Chapter 10: Heaven’s Gate & 999 Stairs (Tianmen Mountain Arch)
│   ├── page_11.png              # Chapter 11: Jazz on the Bund (Fairmont Peace Hotel & Pudong Neon)
│   └── page_12.png              # Chapter 12: Speed of Light & The Keepsake (Maglev & Finale)
│
├── characters/                  # 🎨 Character Turnaround Reference Model Sheets
│   ├── roy_model_sheet.png      # Roy (Protagonist, dark fade, black kippah, white tee)
│   ├── jin_model_sheet.png      # Jin (Tech-savvy friend, glasses, teal/green tunic jacket)
│   ├── mei_model_sheet.webp     # Mei (21yo photography student, dark bob, mint cardigan)
│   └── lao_feng_model_sheet.png # Lao Feng (Veteran guide, red headband, orange utility coat)
│
├── pages_review/                # 🔬 All 25 Generated Candidates (Variants A, B & C)
│   ├── manifest.json            # Structured manifest of all candidate pages and descriptions
│   ├── page_01_a.png / b.png    # Page 1 variants
│   ├── page_02_a.png / b.png / c.png
│   └── ...                      # Pages 03 through 12 variants
│
└── docs/                        # 📜 Scripts, Storyboards & Production Blueprints
    ├── COMIC_SCRIPT_AND_PROMPTS.md  # Complete bilingual storyboard, dialogue & caption script
    └── FLOW_MASTER_PLAN.md          # Google Flow prompt engineering formula and character bindings
```

---

## 👥 Cast of Characters

1. **Roy (רועי)**: The protagonist and world explorer. Athletic build, modern dark fade haircut, wearing a black kippah/yarmulke, white t-shirt, and dark jacket.
2. **Jin (ג'ין)**: Roy's close local friend. Sharp wit, round glasses, wearing modern teal/green tunic jacket.
3. **Mei (מאי)**: Chinese university photography student (21yo). Dark bob haircut with a delicate flower clip, mint-green knit cardigan, pleated skirt, carrying her retro camera around her neck.
4. **Lao Feng (לאו פנג)**: The seasoned veteran guide. Salt-and-pepper beard, red bandana/headband, rugged orange utility jacket. Appears at historical and monumental mountain sites (Forbidden City, Great Wall, Terracotta Army, Zhangjiajie peaks).

---

## 🚀 How to Run & Read

### 1. Launch the Local Server
From a terminal in `c:\Users\Roy\02_Dev\china-comic-book`:
```bash
node serve-review.js
```

### 2. Open the Interactive Comic Book Reader
Navigate to:
```
http://localhost:3456/index.html
```
* **Keyboard Navigation**: Use `Left Arrow` / `Right Arrow` or `A` / `D` to flip pages.
* **Audio**: Subtle page-turn sound effects on navigation.
* **Fullscreen Mode**: Press `F` or click the fullscreen icon.
* **Zoom**: Click any page to zoom into the high-res panels.
* **Filmstrip Bar**: Click any thumbnail at the bottom to jump directly to that chapter.

### 3. Open the Side-by-Side Review Dashboard
Navigate to:
```
http://localhost:3456/review.html
```
* Compare **Option A** vs **Option B** for any page.
* Click to change your selected variant and press **"Save & Finalize Book"** to instantly update `assets/`.
