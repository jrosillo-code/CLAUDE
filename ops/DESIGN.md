---
version: alpha
name: operaciones-con-ia
description: The design system for "Operaciones con IA para corredurías y asesorías", a services-to-product company selling document operations with human review to Spanish insurance brokerages and accounting firms. Paper-white ground, near-black ink, hairline rules, one deep-green accent reserved for the moment a person approves something, an editorial serif for headings over a humanist grotesque for reading, and mono for labels and figures. Real product UI is the imagery; there are no illustrations, gradients or stock photographs. Covers the landing page, the reviewer's screen, the status page, the legal pages and every client-facing document.

colors:
  ground: "#f7f6f2"
  surface: "#ffffff"
  ink: "#15191f"
  ink-2: "#4a525c"
  ink-3: "#7c8590"
  rule: "#e2e0d9"
  accent: "#1e6b4a"
  accent-soft: "#e6f1eb"
  warn: "#a86a12"
  warn-soft: "#f8efdc"
  bad: "#a83a3a"
  bad-soft: "#f6e3e3"
  doc-paper: "#fbfaf7"
  on-ink: "#ffffff"

typography:
  hero-display:
    fontFamily: Newsreader
    fontSize: clamp(40px, 6vw, 64px)
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: -0.01em
  section-title:
    fontFamily: Newsreader
    fontSize: clamp(28px, 3.6vw, 38px)
    fontWeight: 500
    lineHeight: 1.1
  subsection-title:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.2
  card-title:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  lede:
    fontFamily: IBM Plex Sans
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  eyebrow:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    letterSpacing: 0.08em
    textTransform: uppercase
  figure:
    fontFamily: Newsreader
    fontSize: 44px
    fontWeight: 500
    lineHeight: 1
  mono-label:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 400
    letterSpacing: 0.06em
    textTransform: uppercase
  mono-data:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: 400
    fontVariantNumeric: tabular-nums

rounding:
  button: 3px
  pill: 3px
  card: 0px
  queue: 6px
  photo: 4px

spacing:
  unit: 4px
  gutter: 20px
  section: 72px
  section-mobile: 48px
  card: 20px
  row-gap: 14px
  max-width: 1040px
  reading-width: 62ch
---

## Overview

The system exists to make a compliance-minded buyer, the owner of a small Spanish
brokerage or accounting firm, trust software that reads their clients' documents. Every
choice follows from that. The page looks like a well-set document, not a dashboard and
not an AI product: paper ground, ink text, hairlines instead of shadows, an editorial
serif for headings, and generous whitespace. The one color that is not a neutral is a
deep green, and it appears only where a person approves something or where a value has
been read with its source. Nothing else competes for it.

Restraint is the identity. The incumbents (broker ERPs) are dense feature lists with
stock photography; the AI entrants are dark gradients with abstract "agent" language.
This system is neither. It shows the real review screen, publishes prices, uses the
Spanish regulatory vocabulary correctly, and names what happens when the AI is wrong.

## Colors

### Neutrals

| Token | Hex | Role |
|---|---|---|
| ground | #f7f6f2 | Page background. A warm paper white, never pure white. |
| surface | #ffffff | Cards, the queue, tables, form fields. The only pure white. |
| doc-paper | #fbfaf7 | The document pane inside the queue mock; slightly warmer than surface so the source reads as paper. |
| ink | #15191f | Headings, body text, primary buttons. Near-black with a cool bias. |
| ink-2 | #4a525c | Secondary text: ledes, descriptions, table cells. |
| ink-3 | #7c8590 | Tertiary: eyebrows, source lines, footers, mono labels. |
| rule | #e2e0d9 | Every hairline: section borders, card borders, table rows, dashed field separators. |

### Accent

| Token | Hex | Role |
|---|---|---|
| accent | #1e6b4a | The approve action, the "leído" and "válido" state, focus rings, links inside the app. Used nowhere else. |
| accent-soft | #e6f1eb | Background of "leído" and "ok" pills, highlight of quoted source text in the document pane. |

### Semantic

| Token | Hex | Role |
|---|---|---|
| warn / warn-soft | #a86a12 / #f8efdc | "falta" and "pending" states, budget warnings, the draft-notice banner on legal pages. |
| bad / bad-soft | #a83a3a / #f6e3e3 | Errors, rejected states, failed checks. |

Semantic colors are not the accent. They encode state and never decorate.

## Typography

Three families, each with one job.

- **Newsreader** (Google Fonts, optical sizes 6 to 72) carries the voice: H1, H2, H3, the
  big figures on the proof strip and the review screen. Weight 500, tight leading,
  `text-wrap: balance`. Never used for body text or UI controls.
- **IBM Plex Sans** is for reading and operating: body, ledes, buttons, form fields,
  card titles (weight 600). Good Spanish diacritics, calm at 17px.
- **IBM Plex Mono** is for labels and data: eyebrows, mono labels in the queue, the audit
  line, table headers, figures in tables (`tabular-nums`), the status page.

Fallback stacks are declared for every face (Georgia; system sans; Menlo), so a blocked
font host degrades gracefully.

### Hierarchy

| Role | Face | Size | Notes |
|---|---|---|---|
| Hero H1 | Newsreader 500 | 40 to 64px fluid | One sentence with a period. "Tus operaciones, con IA y con control." |
| Section H2 | Newsreader 500 | 28 to 38px fluid | A statement, not a label. "Cinco pasos que hoy hace tu equipo a mano." |
| H3 | Newsreader 500 | 22px | Offers, steps, columns. |
| Eyebrow | Plex Mono | 12px, 0.08em, uppercase, ink-3 | Above every H2; names the section. |
| Lede | Plex Sans | 19px, ink-2 | Under the H1 only. |
| Body | Plex Sans | 17px / 1.55 | Max 62ch. |
| Small | Plex Sans | 14px | Source lines, footers, table cells. |
| Figure | Newsreader | 44px | Proof strip and metrics; unit follows in the same size. |

## Layout

- One column, `max-width: 1040px`, 20px side gutters, centered. Reading text capped at
  62ch. The hero is two columns (text, queue mock) above 820px and stacks below.
- Vertical rhythm by section: 72px padding, 48px on phones, a single hairline between
  sections. No alternating background bands.
- One bento grid on the page (five tiles, one double-width), one three-column step row,
  one three-column offer row, one two-column trust list. Everything collapses to one
  column at 820px. Grid tracks use `minmax(0, 1fr)` so content never widens the page.
- Whitespace does the separating; borders and fills are spent on the few objects that
  need to read as objects: the queue, cards in the bento and offer rows, tables.

## Elevation and depth

Flat. Depth is expressed by hairlines and by ground versus surface. The queue mock has a
6px radius and a 1px `rule` border with a barely visible 1px offset shadow (2 percent
black) so it reads as a window; nothing else has a shadow. Hover states change color, not
elevation. The document pane inside the queue sits on `doc-paper` to read as a sheet.

## Shapes

Buttons and pills 3px; cards 0px (square corners, hairline border); the queue 6px; the
founder photo 4px. No pill-shaped buttons, no large radii, no circles except avatars.

## Components

### Buttons

- Primary: `ink` background, `on-ink` text, 1px `ink` border, 12px by 18px padding, Plex
  Sans 16px 500. "Pide una auditoría de 30 minutos."
- Approve: same shape, `accent` background and border. Only for actions that send a
  message or write into the management system. "Aprobar y enviar", "Aprobar y escribir".
- Ghost: transparent, `ink` text and border. Secondary actions: "Ver la cola de
  revisión", "Corregir", "Rechazar".
- Small (inside field rows): 4px by 8px padding, 13px. "Guardar".
- Focus: 2px `accent` outline, 2px offset. Never remove it.

### Pills (state)

Plex Mono 11px uppercase, 0.05em, 1px by 6px, 3px radius. `ok` (accent on accent-soft):
leído, válido, corregido. `pending` (warn on warn-soft): falta, pendiente. `err` (bad on
bad-soft): error, rechazado. A pill is state, never a category label.

### Cards

Surface background, 1px `rule` border, 20px padding, square corners, content-driven
height. Tiles in a grid share edges and inner padding. The featured offer uses an
`accent` border instead of a fill.

### Field row (the signature component)

The unit of the review screen. A two-column grid: mono label (uppercase, ink-3) with the
state pill on the right; the value below in Plex Sans 500; then the source line in 12px
ink-3 quoting the exact text and page it was read from, or "no consta en el documento";
then an inline correction form (small input plus small ghost button). Rows are separated
by a dashed `rule` line. A corrected value shows the "corregido" pill and "corregido por
{persona}" as its source.

### The queue mock

The hero's image is a real rendering of the review screen: a mono title bar, the
document pane with source text and `accent-soft` highlights on quoted values, the field
rows, the approve and correct buttons, and a mono audit line beneath. It is built from
the same CSS as the app, not a screenshot, so it never drifts.

### Tables

Full width, 14px, hairline rows, mono uppercase headers in ink-3, tabular figures.
Wrapped in an `overflow-x: auto` container; the page never scrolls sideways.

### Forms

Inputs inherit the body font, 1px `rule` border, 8 to 10px padding, no radius beyond
3px. Labels are visible text, never placeholders alone. Every control has an id.

### Status and legal pages

Same system, narrower measure (760px). A warning-bordered card at the top of every legal
draft says it needs counsel review. The status page lists checks as pill plus label plus
detail, and a mono `pre` block for copying.

## Do's and Don'ts

### Do

- Show the real product: the review screen, real document crops (anonymised), the audit
  line. The product is the proof.
- Spend the accent only where a person approves or where a value is verified.
- Publish prices, durations and what happens when the AI is wrong.
- Use the Spanish regulatory vocabulary correctly: Verifactu, SII, RGPD, encargado del
  tratamiento, EIAC, DGSFP, artículo 50 del Reglamento de IA.
- Write in tú with professional vocabulary; one idea per sentence; headings are
  statements with a period.
- Keep numbers on their own line or in a table, in tabular figures.
- Name a person: the founder's name, a phone number, WhatsApp.

### Don't

- No stock photography, handshakes, isometric robots, 3D shapes or gradients.
- No purple or blue "AI" accents; no dark hero; no neon.
- No emoji as section markers; no numbered markers unless the content is a sequence.
- No shadows for hierarchy; no rounded-everything; no cards for things that are not
  objects.
- No SOC 2 badge stack the company does not hold; no fake logos or testimonials.
- No abstract "agents" copy; describe the chain: recibe, lee, valida, pide lo que
  falta, crea la tarea, una persona aprueba.
- Never let the model write the AI disclosure; the code appends it.

## Responsive behavior

- Breakpoints: 820px (grids to one column, hero stacks, section padding 48px), 640px
  (two-column lists stack), 520px (plan phases stack).
- Touch targets at least 40px tall on phones; forms stack; the WhatsApp and phone line
  stays under the hero CTAs.
- Long mono strings (file names, audit line, eyebrows) use `overflow-wrap: anywhere`.
- Tables and code blocks scroll inside their own container only.

## Agent Prompt Guide

Quick reference: ground #f7f6f2, surface #ffffff, ink #15191f, rule #e2e0d9, accent
#1e6b4a (approve only), warn #a86a12, bad #a83a3a. Newsreader 500 for headings, IBM Plex
Sans for text, IBM Plex Mono for labels and figures. Square cards with hairlines, 3px
buttons, no shadows.

Ready prompts:

- "Siguiendo DESIGN.md, crea una página /casos con un caso de estudio: eyebrow, H2 como
  afirmación, tres cifras en Newsreader con su unidad, una tabla de antes y después, y una
  cita del despacho. Sin fotos de archivo. Enlaza el kit de cumplimiento."
- "Following DESIGN.md, add a settlements screen to the review app: a table of reconciled
  statements with tabular figures, a `pending` pill per unpaid line, and an approve button
  in the accent color only on the action that sends the claim to the insurer."
- "Siguiendo DESIGN.md, redacta un PDF de propuesta para una correduría: misma tipografía
  (Newsreader para títulos, Plex Sans para texto), precios públicos de la web, y la sección
  'Qué pasa cuando la IA se equivoca'."

When a request conflicts with this file, follow the file and say so. When the file is
silent, choose the quieter option.

## Known gaps

- Dark mode is not designed; the app is light only for now.
- No icon set; the system uses text and pills instead of icons. Revisit if the app grows
  a navigation rail.
- Catalan and English variants of the copy are not written; typography supports them.
