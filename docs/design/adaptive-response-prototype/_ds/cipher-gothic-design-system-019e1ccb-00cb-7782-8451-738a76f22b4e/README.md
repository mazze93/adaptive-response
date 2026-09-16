# Cipher Gothic — Design System

> The language of systems made intimate.
> Editorial dark · teal & coral · classical serif against geometric mono.

This is the design system for **Mazze LeCzzare** ([mazzeleczzare.com](https://mazzeleczzare.com)) — a personal editorial platform of essays, field notes, and public working documents at the intersection of narrative, cognition, and security-forward design. The brand voice for the site is **Cipher Gothic**: schematic precision in conversation with literary tenderness.

There are two surfaces:

1. **The Blog** (`/blog`) — dark editorial; the field notes; sparse, restrained, technical
2. **The Homepage** (`/`) — a deeper navy editorial; fashion-magazine adjacency for the personal landing page

Both share a single visual vocabulary: an obsidian ground, a teal that operates at two temperatures, and a coral that appears once per composition like a signature or a wound.

---

## Sources

- **Codebase** — [`github.com/mazze93/mazze-leczzare-blog`](https://github.com/mazze93/mazze-leczzare-blog) (Astro 6 · React 19 islands · MDX · Cloudflare Pages)
- **Live site** — [mazzeleczzare.com](https://mazzeleczzare.com) · [blog](https://mazzeleczzare.com/blog)
- **Uploaded references** — `uploads/` (kept in-project): `cipher-gothic-preview.html`, `editorial.css`, `global.css`, `homepage.css`, `hero-environmental-breathing.html`, `TYPOGRAPHY-RATIONALE.md`, `hero-section.md`

The `cipher-gothic-preview.html` is the canonical reference for the blog landing's current visual direction; it supersedes earlier prototypes and is the single source of truth for the latest tokens. The `compass-mark.png` artifact illustrates the brand's signature mark behavior (origin → intention → refraction → transmission → return).

---

## Index — what's in this folder

| File / Folder | Purpose |
| --- | --- |
| `README.md` | This file — full brand & visual reference |
| `SKILL.md` | Agent-compatible skill manifest |
| `colors_and_type.css` | All color and type tokens. **Import this everywhere.** |
| `assets/` | Logos, favicon, headshot, social preview, blog hero imagery |
| `preview/` | Design system cards (registered for the Design System tab) |
| `ui_kits/blog/` | High-fidelity recreation of the blog surface (landing, post, footer, header) |
| `ui_kits/homepage/` | Recreation of the personal landing page (hero, recent posts, about) |
| `_sources/` → `uploads/` | Original uploaded reference files — read-only |

---

## CONTENT FUNDAMENTALS

> **The minimum necessary truth.** Text is sparse. What is written is the bone the structure hangs on.

### Voice & posture
- **First-person, unflinching.** "I left a neuroscience lab after years of measuring cognitive decline in aged macaques." Not "we" — there is a single author behind everything, and the writing never pretends otherwise.
- **The reader is addressed in second person sparingly** and only when the argument requires it ("Your nervous system evolved to process a moving world in under two hundred milliseconds"). Mostly the reader overhears.
- **Confessional + analytical at once.** A paragraph about TLS handshakes can sit next to a paragraph about a psychiatric hospitalization. The voice doesn't switch registers — it holds both.
- **Refuses to flatten.** The defining stance: "make complex ideas legible without flattening them." No dumbing down, no insider opacity.

### Sentence shape
- Short sentences set in pairs and triplets. Then a longer one to breathe.
- Em-dashes do real structural work — they're how clauses with different temperatures get fused without smoothing the seam.
- One-sentence paragraphs are common, used as landings. "It stopped being something I could do."
- Italic body in serif for quiet emphasis (the literary voice). Mono for technical terms (the systems voice). Coral for the single moment of charge.

### Tone & register
- **Calm. Pressurized. Adult.** The default volume is low. Nothing shouts. Nothing winks.
- **Earned warmth.** When tenderness appears, it has been built up to. "Some of them would still accept small treats after testing — even from the same person who had just carried them through a stressful procedure."
- **Precise, never clinical.** Technical writing here always has a body in the room.
- **Doubling, always.** "Locked doors and open poems." "Infrastructure is a kind of literature." "Security protocols are a form of care." This is the brand's signature rhetorical move.

### Casing & conventions
- **Sentence case** for body, headings, and titles inside prose ("The lock icon is not security").
- **lowercase wordmark** ("mazze leczzare" — always lowercase for the brand name in display).
- **ALL CAPS, wide tracking (0.22em)** for eyebrows, labels, and tags — used as system-mind annotation, not shouting.
- **Numbers as numerals** in metadata ("3 entries", "01 / 02 / 03"), spelled out in prose where rhythm requires.

### Specific examples to imitate
- Eyebrow: `∅ CIPHER GOTHIC · FIELD NOTES`
- Thesis quote: *"There is a particular tension in work that lives simultaneously inside locked doors and open poems — the knowledge that infrastructure is a kind of literature, that security protocols are a form of care."*
- Tagline: `Writing at the edge of systems.`
- Coordinate footer: `35.9940° N · 78.8986° W` (Durham, NC) + entry count.
- Post titles: `The Lock Icon Is Not Security` · `We All Float On` · `Southern Gothic, Queer Survival, and the Poetry of Haunting`
- Tag chips (UPPERCASE, tracked): `security` · `essay` · `culture` · `systems`
- Date format: `15 MAR 2025` (mono, tracked, teal)

### Emoji & ornament
- **No emoji.** Ever. The brand uses the null set glyph `∅` as its signature ornament — it appears as a label prefix and stands in for a wordmark fleuron.
- **Box-drawing characters** (`·` `→` `─` `┐` `└`) are used for inline structure, not emoji.
- **Coordinates, indices, and reference numbers** function as ornament. The page is documented like a chart.

---

## VISUAL FOUNDATIONS

### Palette
Three voices, used with the discipline of a master colorist.

| Token | Hex | Role |
| --- | --- | --- |
| `--cg-bg` | `#0B1119` | Obsidian ground. Never pure black; carries a hue of brushed slate. |
| `--cg-surface` | `#111A23` | Cards, panels — barely lifted off ground. |
| `--cg-teal` | `#34C3B9` | Glass-fiber teal. Primary accent — links, marks, the signal. |
| `--cg-teal-warm` | `#2BD3C6` | The pulsing-signal teal — glows, hero highlights, drop shadows. |
| `--cg-teal-dim` | `#1C6964` | Deep teal — borders, rules, decorative frame marks. |
| `--cg-teal-ghost` | `#0E2525` | Hover-state wash — a teal so faint it reads as warmth, not color. |
| `--cg-coral` | `#E85A4A` | The wound / the signature. **Appears once per composition.** |
| `--cg-fg` | `#EBE7E0` | Bone-white — body text. Warm-toned, never icy. |
| `--cg-fg-bright` | `#F2F4F8` | Heading whites. |
| `--cg-fg-mid` | `#5A6C7C` | Body secondary, descriptions. |
| `--cg-fg-sub` | `#374856` | Metadata, indices. |
| `--cg-rule` | `#1A3A38` | Hairline rules. |

**Coral discipline:** at most one coral element per visual composition. It is the URL underline, or the single tag, or the `∅` glyph. Never both. Never a coral button next to a coral link. Scarcity is what makes it work.

### Typography
A duality. Two voices that share the canvas without merging.

- **Cormorant Garamond, 300–400 weight** — classical serif in oblique attitude. Carries the literary soul. Used for headings, thesis quotes, post titles, prose body on long-form posts. Italic 300 is the brand's most distinctive register.
- **JetBrains Mono, 300–400 weight, widely tracked** — geometric mono for system-mind annotation: eyebrows (0.22em tracking), labels, dates, coordinates, indices, footer marks. The "documentation" voice.
- **Inter, 400 weight** — refined sans for UI body, descriptions, secondary text. Disappears into utility; never tries to compete with the serif or mono.

**Substitutions flagged:** The original Astro codebase imports Cormorant Garamond and DM Mono via `@fontsource`. We use Cormorant Garamond + JetBrains Mono via Google Fonts CDN — JetBrains is a near-twin of DM Mono with slightly more humanist warmth, matching the latest `cipher-gothic-preview.html` direction. **If you need pixel-exact fidelity to the deployed blog, swap JetBrains Mono → DM Mono.** Inter substitutes for the absent system sans in the prototype.

### Spacing
A loose 8pt scale, deliberately uneven at the top end to allow generous breathing room.

`0.25 · 0.5 · 0.75 · 1 · 1.5 · 2 · 3 · 4 · 6 rem` — see `colors_and_type.css` for the `--space-*` tokens.

Layout uses a **780px max width** (`--measure-page`) and **720px prose measure** (`--measure-prose`). Pages have *air* on the sides — never edge-to-edge text.

### Backgrounds
- **Solid obsidian** is the default. The depth comes from being still, not from gradient or texture.
- **No gradients** except: the radial darkness-breathing field in the hero canvas animation, and a vignette overlay on full-bleed hero images.
- **No textures, grain, or patterns** under text. Decoration lives at the page edges.
- **Hero canvas animations** are particle networks — sparse points and connection lines, sampling teal / amber / magenta in the noise zone, resolving to teal in the signal zone.
- **Full-bleed editorial photos** appear only as blog post heroes. They are dark, atmospheric, color-graded toward the brand palette (cool with selective warm highlights).

### Backdrops & artifacts
- **Frame marks** — four small L-shaped corner brackets (`20px × 20px`, `1px` teal-dim stroke) at page corners. The page is *documented*, like an instrument.
- **Rule lines with terminations** — horizontal hairlines that don't go edge-to-edge; they break at a teal dot, a short stub, or a chevron.
- **Coordinate annotations** in the footer (`35.9940° N · 78.8986° W` — Durham, NC). The page is *located* in physical space.
- **Index numerals** in mono (`01`, `02`, `03`) attached to list items — the page is *enumerated*.

### Animation
- **Direction: fade-up, low amplitude.** `translateY(8–18px)` + `opacity 0→1` with `cubic-bezier(0.22, 1, 0.36, 1)` or `cubic-bezier(0.16, 1, 0.3, 1)` over 500–900ms.
- **Stagger by 50–100ms** between siblings — never simultaneous reveal.
- **The hero thesis animates with a slight `blur(2px) → 0` filter** alongside the fade. Subtle, but it's the brand's signature entrance.
- **Rule lines scale in from origin-left** at 0.8s — the geometry is *drawn*, not faded.
- **No bounces, no springs, no overshoot.** Everything decelerates calmly.
- **`prefers-reduced-motion`** disables all entrance animations and the canvas particle loop. Static snapshot only.

### Hover & press
- **Hover on cards/links:** background fills with `--cg-teal-ghost` (`#0E2525`) — a teal so faint it reads as warmth. The title shifts to `--cg-teal`. A small right-edge arc fades in (`border-color: transparent → var(--cg-teal)`).
- **Hover on inline links:** color shifts from `--cg-teal` → `--cg-coral`. (This is one of the rare moments coral is allowed to repeat.)
- **Press / active:** no shrink, no shadow. Slight color darken (`--cg-coral-dim`, `--cg-teal-dim`).
- **Focus-visible:** 2px solid teal outline, 3–4px offset, `--radius-sm` corner.
- **Transitions:** `150ms ease` on color, `250ms ease` on background. Never `transition: all`.

### Borders, shadows, radii
- **Borders are hairlines.** `1px solid var(--cg-rule)` is the default; `1px solid var(--cg-teal-dim)` on accent cards.
- **No shadows** of any kind. The system is unconditionally flat. Depth comes from color-on-color, never from elevation.
- **Radii are minimal**: `2–4px` for most elements. Tags and code use `2px`. Buttons and post links use `4px`. Images use `6px`. **Never pill or fully rounded.** Sharpness is part of the system's character.
- **No "card with rounded corners and colored left border."** Tags use a stroked outline at the same color as the text.

### Cards
A card in Cipher Gothic is:
- A region with **hairline divider above and/or below** (not boxed),
- Lifted by `--cg-surface` (`#111A23`) at most, often no fill at all,
- Has a mono-tracked index numeral floating in the gutter,
- Reveals a right-edge arc (`10×24px`, top/right/bottom-right border) on hover.

Not boxed. Not floating. Listed.

### Transparency & blur
- **Header backdrop blur:** `backdrop-filter: blur(12px)` on the sticky site header, `rgba(11, 17, 25, 0.92)` background. Used only for the header.
- **No frosted glass anywhere else.** No translucent cards. No blur as decoration.
- Alpha is used for text hierarchy (`rgba(242, 244, 248, 0.65)` for subtitles), not for surface effects.

### Imagery
- **Cool, atmospheric, dark.** Hero photography is graded toward the obsidian + teal palette. Warm highlights are allowed but never warm shadows.
- **Grain is welcome** in hero photography (it reads as physical, document-like).
- **No stock illustration.** No 3D renders. No isometric anything. Photographic or hand-drawn only.
- **Triptychs** are a recurring motif — three panels with mono labels and sublabels, often used to organize concepts (Mind · Instrument · Structure).
- **Aspect ratios:** hero images are wide (16:9 or wider). Triptych panels are 4:5 portrait.

### Layout rules
- **780px max content width** for the blog landing; **720px prose measure**.
- **Centered single column** is the default. No sidebars, no full-bleed except hero images.
- **Sticky site header** with backdrop blur.
- **Footer is documentation**: coordinate + entry count + colophon, all in mono, all small.
- **Asymmetric balance.** The hero image-text alignment leans right ("From Erasure → Signal" sits in the right two-thirds; the particle field fills the left).

---

## ICONOGRAPHY

> **No icon font. No emoji. Use Unicode glyphs as ornament and copy assets when possible.**

### The brand mark
The signature graphic is a **compass / iris / lens mark** — concentric rings around a central "iris" with a small teal-and-coral signal at center. See `assets/compass-mark.png` for the full behavior study (idle → hover → focus → engaged → complete). The mark is **drawn in thin teal stroke** on dark; it is the brand's visual analog for "alignment with an invisible field."

The mark scales from 16px favicon up to 256px hero use. It is **never filled, always stroked**, always thin (`1–2px` at most sizes).

### Marks in use
- **Favicon** (`assets/favicon.svg`) — a stylized `M` in stroke (#00E5FF). Minimal, single path.
- **Compass mark** (`assets/compass-mark.png`) — the canonical instrument-graphic study. Use this as the brand's "fleuron" — appears in about pages, colophons, and as the marker between major content sections.
- **Hero signal grid** (`assets/hero-signal-grid.svg`) — minimal SVG of the particle-network signal motif.

### Unicode glyphs used in copy
| Glyph | Where | Meaning |
| --- | --- | --- |
| `∅` | Eyebrows, label prefixes | The empty set — the brand's signature ornament. Always in coral. |
| `·` (middle dot) | Between metadata items, in coordinate strings | Standard separator |
| `→` (rightward arrow) | "From Erasure → Signal" | Process / movement |
| `°` `′` `″` | Coordinate footers | Documentation tone |
| `—` (em dash) | Throughout body copy | The brand's primary structural punctuation |

### Functional iconography
Where icons are required (theme toggle, share, close, social), the brand uses **stroked single-path SVGs** at `1.5px` stroke weight, in `var(--cg-teal)` or `var(--cg-fg-mid)`. Use the **Lucide icon set** from CDN as the closest match to the brand's stroke language: `https://unpkg.com/lucide-static@latest/icons/`.

**Substitution flagged:** Lucide is a substitution. The original codebase has no icon library — icons appear only as inline SVG within specific components (`ThemeToggle` is text-only; the `PostQuoteShare` uses small custom SVGs). If pixel-exact icon fidelity matters, hand-author SVGs in the same stroke language rather than reaching for a CDN set.

### What to avoid
- ❌ Emoji of any kind
- ❌ Filled icons (Material, Bootstrap solid)
- ❌ Multi-color illustrated icons
- ❌ Icons larger than 24px in UI surfaces (the system is text-first)
- ❌ Decorative SVG flourishes that aren't grounded in the brand's geometric vocabulary (circles, ticks, brackets, rules)

---

## Notes for designers using this system

- **Start every layout from black.** Add the teal sparingly. The coral last, and only once.
- **Mono is annotation.** If a label could be set in any of the three voices, set it in mono.
- **Serif is the soul.** Headings, thesis lines, post titles, prose — anything that should feel said by a person.
- **Sans is utility.** Body descriptions and short UI text — anything functional.
- **Rules are not decoration.** Every rule line should mark a real boundary. Don't add them for visual rhythm.
- **The page is an instrument.** Frame marks, coordinates, index numerals are part of the system's voice — they are not "extras."

— end —
