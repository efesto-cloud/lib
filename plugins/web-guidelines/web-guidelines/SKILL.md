---
name: web-guidelines
description: Efesto brand and style guidelines — colors, typography, logo, tone of voice, and company facts. Use whenever producing anything that represents Efesto: websites, landing pages, slide decks, PDFs, emails, social posts, UI components, marketing copy, or any visual or written asset that should be on-brand. Triggers include "make it on-brand", "use the Efesto colors", "match our style", "Efesto branding", "brand guidelines", or building any customer-facing artifact for Efesto.
---

# Efesto — Brand & Style Guidelines

Source of truth: the Efesto site (`efesto.cloud`) — see `public/index.html`.
Apply this skill to every artifact that represents Efesto so visuals and voice
stay consistent across web, decks, documents, and social.

Efesto is a senior team of **software craftsmen** ("artigiani del software") —
*"Dal bisogno al prodotto, senza intermediari."* From a workshop to a delivered
product, end-to-end, AI-driven, with no vendor lock-in. The brand metaphor is
the **forge**: fire, coal, ember, spark, the anvil. The signature line is
*"Il fuoco al centro"* — the fire at the center.

**One brand, one business unit.** Efesto has a single brand — there are no
sub-brands or service-line lockups. Everything ships under the one Efesto mark.

The brand voice is **Italian** by default (the site, copy, and labels are in
Italian); keep Italian unless the artifact is explicitly for an
English-speaking audience.

## Web artifacts — start from `assets/efesto.css`

For any HTML/CSS artifact, don't rebuild the system by hand — link the bundled
stylesheet:

```html
<link rel="stylesheet" href="efesto.css">
```

Copy **both** [`assets/efesto.css`](assets/efesto.css) and
[`assets/efesto-tokens.css`](assets/efesto-tokens.css) next to your HTML, then
link `efesto.css` — it imports the tokens. For a single self-contained file,
paste `efesto-tokens.css` then `efesto.css` into one `<style>` block (the
`@import` for the tokens then harmlessly no-ops). `efesto.css` loads Cormorant
Garamond + JetBrains Mono, applies the **light** theme to `<body>`, and ships a
few brand classes: `.efesto-container`, `.efesto-section`, `.efesto-eyebrow`
(the mono label), `.efesto-accent` (the italic accent keyword), `.efesto-button`,
and `.efesto-logo`.

### Light & dark — the forge inverts

The brand is **light by default**: a warm cream paper canvas with near-black
coal text. This is the opposite of a dark-first brand — light is home, and the
dark *forge canvas* is the dramatic accent used for select sections (the
ecosystem, a stat block, a footer).

```html
<html data-theme="dark">          <!-- whole page on the forge canvas -->
<div data-theme="dark"> … </div>  <!-- one dark region            -->
<section class="efesto-dark"> … </section>  <!-- equivalent shorthand -->
```

`data-theme="light"` forces light again inside a dark area. Components read
semantic role variables (`--efesto-bg`, `--efesto-text`, `--efesto-heading`,
`--efesto-strong`, `--efesto-muted`, `--efesto-surface`, `--efesto-border`,
`--efesto-accent`, `--efesto-accent-line`, `--efesto-logo`), so colors,
headings, surfaces — and the accent keyword color — flip automatically. The
accent deliberately **changes between themes**: forge on light, spark on dark
(see below). `style-guide.html` has a worked light/dark toggle.

### Tokens — for non-CSS frontends

[`assets/efesto-tokens.css`](assets/efesto-tokens.css) is the
framework-agnostic source of truth: every brand value as a plain custom
property. Building with React, Tailwind, or CSS-in-JS rather than plain CSS?
Read that file (or the token tables below) and map the values into your own
theme config — don't ship `efesto.css` into a framework that already owns its
styling layer.

[`assets/style-guide.html`](assets/style-guide.html) is a visual reference for
the whole system — color swatches, the type scale, the logo variants, and a
live light/dark toggle on one page. Open it to see the brand at a glance; it is
documentation, not a screen to copy.

## Color palette

The palette is a **forge**: warm cream paper, near-black coal, and a graded
fire accent — deep forge red, brighter ember orange, light amber spark. Use the
fire colors sparingly — they are the heat, not the field.

| Token            | Hex       | RGB                  | Role |
|------------------|-----------|----------------------|------|
| `--efesto-forge` | `#B84A1E` | `rgb(184, 74, 30)`   | Primary accent — italic keyword, rules, CTAs (on light) |
| `--efesto-ember` | `#E8722A` | `rgb(232, 114, 42)`  | Secondary accent — rules & glow on the dark canvas |
| `--efesto-spark` | `#FAC775` | `rgb(250, 199, 117)` | Amber highlight — italic keyword on dark, key numbers |
| `--efesto-gold`  | `#C8963C` | `rgb(200, 150, 60)`  | Muted brass — rare, fine detail |
| `--efesto-coal`  | `#14110E` | `rgb(20, 17, 14)`    | Near-black — headings on light, the dark canvas itself |
| `--efesto-ash`   | `#2A2622` | `rgb(42, 38, 34)`    | Raised surface / border on the dark canvas |
| `--efesto-stone` | `#4A453F` | `rgb(74, 69, 63)`    | Body text on light |
| `--efesto-steel` | `#5A5C60` | `rgb(90, 92, 96)`    | Cool neutral — the "tool" side, secondary dividers |
| `--efesto-dust`  | `#8A8178` | `rgb(138, 129, 120)` | Muted — captions, body text on dark |
| `--efesto-warm`  | `#EFE8DC` | `rgb(239, 232, 220)` | Warm off-white — text on the dark canvas |
| `--efesto-light` | `#F8F4ED` | `rgb(248, 244, 237)` | Card / raised surface on light |
| `--efesto-paper` | `#FAF7F1` | `rgb(250, 247, 241)` | Primary light canvas (cream) |

### Usage rules

- **Default surface is light.** Background `#FAF7F1` (paper), headings `#14110E`
  (coal), body `#4A453F` (stone). Never pure-white `#FFFFFF` for the canvas —
  the warmth of the cream paper is part of the brand.
- **Fire is the accent, graded by context.** On the light canvas the accent is
  **forge `#B84A1E`** (the italic keyword, eyebrow rules, CTA borders). On the
  dark coal canvas the accent shifts warmer: the italic keyword becomes
  **spark `#FAC775`** and rules become **ember `#E8722A`** — forge is too dark
  to read on coal. The semantic tokens do this automatically; respect it when
  hand-rolling.
- On the dark forge canvas (`#14110E`), text is `#EFE8DC` / `#8A8178`, headings
  `#FAF7F1`.
- `steel #5A5C60` is the deliberate **cool counterpoint** — used for the "tool /
  fai-da-te" side of the strumento↔applicazione distinction and neutral
  dividers. Don't promote it to a brand accent; the brand is warm.
- Keep fire colors off large fills. A page is paper-and-coal with heat applied
  at the keyword, the rule, the one number — not a wash of orange.

```css
/* These ship as custom properties in assets/efesto-tokens.css */
:root {
  --efesto-forge: #B84A1E;
  --efesto-ember: #E8722A;
  --efesto-spark: #FAC775;
  --efesto-coal:  #14110E;
  --efesto-stone: #4A453F;
  --efesto-dust:  #8A8178;
  --efesto-warm:  #EFE8DC;
  --efesto-paper: #FAF7F1;
}
```

## Typography

Two typefaces in deliberate tension — an **editorial serif** for display and an
**engineering monospace** for everything technical. The pairing *is* the brand:
craft meets code.

**Display — [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond)**
(free, Google). High-contrast serif for headlines, section heads, leads, and
big numbers. Fallback: `Georgia, serif`.

**Text / UI — [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)**
(free, Google). Monospace for body copy, eyebrows, labels, nav, captions, and
buttons. Fallback: `ui-monospace, Menlo, monospace`.

| Element | Typeface | Size (desktop) | Weight | Notes |
|---------|----------|----------------|--------|-------|
| H1 / hero | Cormorant Garamond | ~88px | 300 | Airy, line-height ~0.92, letter-spacing −0.025em |
| H2 / section | Cormorant Garamond | ~72px | 300 | line-height ~1.02 |
| H3 / card | Cormorant Garamond | 30–32px | 400 | sub-section titles |
| Lead | Cormorant Garamond *italic* | 19–24px | 300 | the italic standfirst under a head |
| Eyebrow / label | JetBrains Mono | 11px | 400 | UPPERCASE, letter-spacing 0.2–0.4em |
| Body | JetBrains Mono | 14–16px | 400 | line-height ~1.7 |
| Big number | Cormorant Garamond | 120–180px | 300 | stats (e.g. the "20%") |

### Type rules

- Display heads (H1/H2) are set at **light weight 300** — impact comes from
  scale and the italic, not bold. H3 steps to 400; mono labels to 400–500.
- The signature move: **one italic keyword** inside a head glows in the accent
  color (`em` or `.efesto-accent` — forge on light, spark on dark). Keep it to a
  single word or short phrase per headline, e.g. "Un *team*, non un'agenzia."
- Headlines are sentence case, **not** all-caps. Only the small mono eyebrows
  and labels are uppercase + wide-tracked.
- Section numbers use the serif italic with a small forge/ember rule beside them
  (e.g. *"01 · La forma"*). Eyebrows often lead with a `→` glyph.
- Don't swap the roles: serif is never body copy, mono is never a big display
  headline.

## Logo

The logo ships as SVG sources in [`assets/logo/`](assets/logo/) — always use
them directly; never recreate, retype, or trace the mark. The wordmark spells
"Efesto"; the **"f"** is drawn as a rising flame and is the fixed fire accent,
while the other letters are color-neutral (`fill="currentColor"`) so the body
adapts to context. There are no sub-brand lockups — this one mark is the whole
system.

| File | Form | Use |
|------|------|-----|
| `logo/wordmark.svg` | "Efesto" wordmark, letters `currentColor` + **forge** flame | Light backgrounds. Set `color: var(--efesto-coal)`. |
| `logo/wordmark-dark.svg` | Same wordmark, letters `currentColor` + **ember** flame | Dark forge canvas. Set `color: var(--efesto-paper)`. The flame is brightened to ember so it stays legible on coal. |
| `logo/icon.svg` | Square rounded badge — "Ef" monogram on a white field | Favicon, app icon, social avatar, any tight square. Self-contained white background → loads via `<img>` / `<link rel="icon">` anywhere. |

### Inlining for `currentColor`

For the wordmarks, **inline** the SVG into your HTML and set the CSS `color`
property on it (or a parent via `.efesto-logo`). `currentColor` follows `color`,
so the letters render coal on the light page and paper on the dark canvas. Do
**not** load a wordmark via `<img>` — an un-inlined `currentColor` SVG has no
color context and the letters render **black** (invisible on the dark canvas).
The `icon.svg` badge is fully colored with its own white field and is safe via
`<img>`.

### Logo rules

- Pick the file by background: `wordmark.svg` on light (coal letters, forge
  flame), `wordmark-dark.svg` on the dark canvas (paper letters, ember flame).
  Use `icon.svg` for favicons and square avatars.
- The flame "f" is the brand's signature heat — never recolor it to a neutral,
  and never recolor the letter body to fire. Letters are coal/paper; only the
  flame is fire.
- Never add shadows/effects, stretch, rotate, or place the mark on a
  low-contrast or busy background. Keep the forge flame off light orange/amber
  fills where it would disappear.
- Preserve clear space around the mark equal to the cap-height of "E".
- **Favicon / app icon:** use `logo/icon.svg` (or the PNG exports
  `favicon-32.png` / `favicon-512.png` / `apple-touch-icon.png` shipped in the
  site's `public/`). It is already a perfect square with its own background.

## Beyond the web — decks, PDFs, emails

The tokens above are the source of truth for every artifact; only the delivery
changes. The constants everywhere: warm paper canvas, coal text, Cormorant
Garamond + JetBrains Mono, fire as a scarce graded accent, and the logo pulled
from [`assets/logo/`](assets/logo/).

**Slide decks (PowerPoint, Google Slides, Keynote).** Default to the light
paper canvas (`#FAF7F1`) with coal text and one fire accent per slide (a key
number, the italic keyword, a divider rule). Use dark coal slides for drama —
section dividers, a single stat, the closing. Title/divider slides carry the
wordmark (coal on light, paper on dark). If the fonts can't be embedded, fall
back to Georgia (display) and a monospace such as Consolas/Courier for
labels — never a generic sans for the headlines.

**PDFs & documents.** Reports, letters, and memos: paper `#FAF7F1` (or white)
page, stone `#4A453F` body, coal `#14110E` headings, forge reserved for rules,
callouts, and one keyword. Use `wordmark.svg` on the light page. Designed/
marketing PDFs may flip to the dark coal canvas — just match the logo
(`wordmark-dark.svg`) and text colors to the background.

**Emails.** Most clients strip web fonts, so set the font stack to a system
fallback (`Georgia, serif` for any display line; `Arial, Helvetica, sans-serif`
for body — a true monospace is risky in email) and inline every style. For a
plain-text signature, use the Company facts block below.

## Tone of voice

Honest, direct, craft-proud. Efesto positions itself as a senior team you talk
to directly — no commercial layer between you and the people writing the code.
The register is confident but plain; it sells *delivered product*, not hours or
hype.

- **Voice:** expert and candid. Precise about what costs what, upfront about
  trade-offs ("dichiariamo prima quanto costa ogni livello di qualità"). Warm
  but unsentimental.
- **Metaphor:** the **forge** — fire, coal, ember, spark, anvil, the craftsman
  ("artigiano"). The signature verb is **"forgiare"**; the signature line is
  *"Il fuoco al centro."* Phases get forge names ("Forge Sprint").
- **Stance:** explicitly *not* AI hype, *not* vendor lock-in, *not* body
  rental. Name what it isn't — that honesty is part of the voice.
- **Structure:** short, declarative sentences. Address the client as "tu". Lead
  with their outcome and their ownership.

### Voice examples (verbatim from the site)

- "Dal bisogno al prodotto, senza intermediari."
- "Un team senior, non un'agenzia."
- "End-to-end, dal workshop al codice."
- "Velocità con onestà."
- "Codice, dati, architettura restano tuoi. L'uscita pulita è dentro il
  contratto."
- "Non vendiamo ore. Vendiamo prodotto consegnato."
- "Il fuoco al centro."

### Method vocabulary

Efesto describes its work as a five-phase method — keep this language when
describing the offering:

1. **Ingresso per formazione** — an AI workshop for the client's own people;
   show what's already possible.
2. **Strumenti fai-da-te** — the team builds its own internal tools and gains
   confidence.
3. **Emersione del bisogno** — the limits of those tools surface a real need:
   a durable, distributed, secure application.
4. **Forge Sprint** — classic software development done well: discovery, weekly
   sprints, continuous demos, AI-driven on the architecture.
5. **Offload consapevole** — hand-off to the client; code written to be handed
   over, so Efesto stays free for the next project.

Keep the **strumento ≠ applicazione** distinction: the client builds *tools*
(internal, AI-guided, single-task); Efesto builds *applications* (distributed,
secure, scalable, on the proprietary architecture) — ownership always stays
with the client.

### The five values

Libertà (no vendor lock-in, total ownership) · Creatività (the cut the factory
doesn't see) · Sostenibilità (economic, technical, environmental) · Data
sovereignty (your data stays yours) · Stewardship del codice (open source, give
back). Return to these when a decision gets hard.

## Company facts

- **Name:** Efesto
- **Tagline:** Dal bisogno al prodotto, senza intermediari.
- **Descriptor:** Software · AI-driven
- **Signature line:** Il fuoco al centro.
- **Email:** info@efesto.cloud
- **Website:** https://efesto.cloud
- **Copyright line:** © Efesto · Tutti i diritti riservati.

> Legal entity, VAT/P.IVA, registered address, phone, and LinkedIn are not yet
> published on the site. Fill them in here once confirmed — don't invent them
> for an artifact; omit unknown fields rather than guess.
