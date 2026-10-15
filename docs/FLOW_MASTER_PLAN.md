# Google Flow: Scene Generation Architecture & Master Execution Plan
**Project**: *Roy's China Adventure*  
**Flow URL**: `https://flow.google.com/project/4c3ec223-1209-41c9-a061-d39081234465`  
**Engine**: `Nano Banana 2.1 🍌`  
**Characters Locked**: `Roy`, `Jin`, `Lao Feng`, `Mei`

---

## 1. Deep Dive: How Google Flow Works & Its Core Features

Google Flow is a project-centric generative narrative studio. Unlike standard one-shot image generators (like Midjourney or basic DALL-E), Flow maintains **persistent project memory**, **character identity consistency**, and **scene continuity**.

### A. The Character Engine & Identity Retention
* **Model Sheet Embeddings**: Each character in the `דמויות` (Characters) tab (`Roy`, `Jin`, `Lao Feng`, `Mei`) acts as an active visual anchor. Flow extracts their key features (face geometry, hair silhouette, costume colors, and cel-shaded line art).
* **Character Tagging / Attachment**: When working in Flow, characters are not described from scratch each time. Instead, you attach them to the prompt using the `+` / `Agent` button or by typing their name. Flow's agent injects the character's turnaround vectors into the generation latent space.
* **Behavioral Directives (`פרטי הדמות`)**: Flow uses the behavioral descriptions you entered to guide character poses, facial expressions, and interactions without needing long descriptive paragraphs every time.

### B. The Scenes Workspace (`סצנות`)
* **Dedicated Narrative Space**: The `סצנות` tab is designed specifically for multi-character staging, environmental backdrops, and sequential storytelling.
* **Format Control (`פורמט`)**: Allows setting the exact canvas aspect ratio:
  * `לאורך` (Portrait / 2:3): **Mandatory for our digital comic book pages.**
  * `לרוחב` (Landscape / 16:9): For cinematic wide panorama splashes.
  * `ריבוע` (Square / 1:1): For character vignettes.

### C. The Flow Agent & Multi-Character Staging (`Agent`)
* The `Agent` toggle on the prompt bar tells Flow's reasoning model to orchestrate complex interactions between two or more attached characters (e.g. *"Roy and Jin toasting at the table while Mei takes a photograph"*).
* The Agent parses spatial logic (who is in front, who is in the background, who is speaking) to prevent character merging (where features of one character bleed into another).

### D. The Tool Suite (`כלים`)
* **Inpainting / Local Edit (`ניסיון חוזר` / Edit Brush)**: Allows modifying specific parts of a generated scene (e.g., fixing a hand, adjusting an expression, or changing a sign) without regenerating the entire page.
* **Variant Generation (`יצירה חוזרת`)**: Generates alternate takes while keeping composition and character seeds locked.
* **Upscale / High-Res Export**: Generates full-fidelity assets ready for print and digital publishing.

---

## 2. The 4-Stage Scene Generation Workflow in Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: Scene Staging & Character Binding                  │
│ • Navigate to "סצנות" (Scenes) tab                          │
│ • Set Format to "לאורך" (Portrait / 2:3)                    │
│ • Click "+" / "Agent" to attach Characters in this scene    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: Structured Comic Prompt Execution                  │
│ • Paste Page Prompt (Tiers, Actions, Captions, SFX)         │
│ • Execute Generation under Nano Banana 2.1                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: Quality Control & Consistency Verification         │
│ • Verify character faces match reference sheets             │
│ • Verify comic panel gutters, caption boxes, dialogue tails │
│ • If needed, use Inpaint/Regenerate for minor tweaks        │
│ • Click "סיום" (Done) to commit page to Scene Media         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: Final Book Assembly                                │
│ • Export all 12 finished 2:3 pages                          │
│ • Compile into interactive HTML5 web flipbook reader        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The 12-Page Generation Production Schedule

| Page # | Scene Title | Characters Attached in Flow | Setting / Key Moment |
| :---: | :--- | :--- | :--- |
| **01** | **The High Horizon** | `@Roy`, `@Jin`, `@Mei` | Atmosphere Bar 80th-floor, Beijing night skyline toast. |
| **02** | **Imperial to Avant-Garde** | `@Roy`, `@Lao Feng`, `@Mei` | Meridian Gate (Forbidden City) & 798 Art District factory. |
| **03** | **The Dragon’s Crest** | `@Roy`, `@Jin`, `@Lao Feng`, `@Mei` | Mutianyu Great Wall snowy peaks & downhill toboggan rush. |
| **04** | **Sanctuary in the Capital** | `@Roy`, `@Jin`, `@Mei` | Warm candlelight Shabbat table in Chaoyang amidst the cold city. |
| **05** | **Velocity of Steel** | `@Roy`, `@Mei` | High-speed G-Train cabin racing at 350 km/h across plains. |
| **06** | **Sunset Ramparts** | `@Roy`, `@Mei` | Cycling atop the 14km ancient Xi'an City Wall at sunset. |
| **07** | **The Silent Legion** | `@Roy`, `@Lao Feng` | Terracotta Army Pit 1 & sizzling night market woks in Muslim Quarter. |
| **08** | **The Sky Elevator** | `@Roy`, `@Jin`, `@Mei` | 326m Bailong glass elevator climbing vertical karst cliff into mist. |
| **09** | **Floating Monoliths** | `@Roy`, `@Lao Feng`, `@Mei` | "Avatar" Hallelujah mountain pillars & natural stone bridge. |
| **10** | **Heaven’s Gate** | `@Roy`, `@Lao Feng`, `@Jin` | Tianmen Mountain colossal natural arch & 999 stone stairs. |
| **11** | **Jazz on the Bund** | `@Roy`, `@Jin`, `@Mei` | Fairmont Peace Hotel 1920s jazz to neon Bund rooftop view. |
| **12** | **Speed of Light (Finale)** | `@Roy`, `@Jin`, `@Lao Feng`, `@Mei` | 431 km/h Maglev train into tomorrow, keepsake photo, "THE END". |

---

## 4. Flow Prompt Formula for Every Page

To guarantee that Flow generates a **true comic book page** (and not just a random illustration), every prompt entered into Flow must follow this 4-part formula:

1. **Format & Canvas Token**:  
   `Graphic novel comic book page in vertical 2:3 portrait format, dynamic multi-tier panel layout with clean black gutters.`
2. **Character Binding Tokens**:  
   `Featuring [Character 1 Name] and [Character 2 Name] matching their project model sheets in cel-shaded avatar style.`
3. **Tier / Storyboard Breakdown**:  
   * `Top tier: Wide establishing panel of [Location] with yellow narrative caption box reading "[Caption Text]" and speech balloons.`  
   * `Middle tier: Two asymmetrical panels showing [Character Interaction / Reaction / Camera shot].`  
   * `Bottom tier: Dynamic action/climax panel with bold sound effect "[SFX]" integrated into the art.`
4. **Art Style Anchor**:  
   `Clean black ink linework, vibrant cel-shaded color blocking, authentic graphic novel lettering and speech balloons.`
