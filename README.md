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
