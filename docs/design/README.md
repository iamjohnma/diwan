# Diwan Design — v1

Source of truth is the Pencil file at [`des.pen`](../../des.pen) (repo root).
This document catalogs every designed screen/state and records the decisions
behind them. Static PNG exports are generated on demand and are not committed
to this repository. It complements [`PRD.md`](../../PRD.md) and
[`IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md) — read those for
*why*, this for *what it looks like*.

## Design system

**Primary color — "Ledger Wine" (`#7a2e42`).** Not eyeballed: every derived token (hover/active/light/foreground, the neutral background+text ramp, the success/warning/error trio) was generated from the primary's actual OKLCH values and validated, not guessed —

- **Contrast**: every text-on-background and foreground-on-primary pairing passes WCAG (checked, not assumed — this caught a real bug: the warning badge originally failed contrast at 2.57:1, fixed to 3.80:1).
- **Colorblind-safe separation**: the primary and the error color sit close in hue (both reddish), so mutual distinguishability was checked with Machado-2009 ΔE simulation across protan/deutan/tritan, not just eyeballed — confirmed well-separated (ΔE 26.9, target is 12).
- **Neutral ramp** carries a whisper of the primary hue (not pure grey) so it reads as chosen, not default.

**Typography**: Amiri (Naskh-style serif, formal/legal register) for headings and display text; Tajawal for body/UI — Arabic-only for v1 (see PRD §5.3), no bilingual i18n scaffolding.

**Component library** (all in `des.pen` as reusable components): Button (primary/secondary/outline/ghost/destructive), Badge (primary/success/warning/error), Input Group, Card (header/content/actions slots), Tab + Tab Chip (active/inactive), Dialog Shell, Empty State Pattern, and the full navigation set below.

### Token values

Authoritative source is `des.pen`'s own variables (`mcp__pencil__get_variables`) — the table below is a snapshot for convenience when wiring up the actual token files (`colors.css`/`theme.css` per the Frontend Manifesto's two-tier architecture), not a second source of truth. If it ever drifts from `des.pen`, trust `des.pen`.

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `primary` | `#7a2e42` | | `text-primary` | `#1d1315` |
| `primary-hover` | `#67142f` | | `text-secondary` | `#5d4e51` |
| `primary-active` | `#560020` | | `text-tertiary` | `#8a7c7e` |
| `primary-light` | `#fde4e8` | | `success` | `#007936` |
| `primary-foreground` | `#ffffff` | | `success-bg` | `#e0f7e5` |
| `secondary` | `#ffeff1` | | `warning` | `#ae6900` |
| `secondary-hover` | `#fbe7ea` | | `warning-bg` | `#feedd7` |
| `secondary-active` | `#f7dfe3` | | `error` | `#c92f33` |
| `secondary-foreground` | `#7f1a3b` | | `error-bg` | `#ffe8e4` |
| `background-base` | `#ffffff` | | `border-default` | `#ded2d4` |
| `background-surface` | `#fdf9f9` | | `border-strong` | `#c1b3b5` |
| `background-elevated` | `#f8f2f3` | | `radius-sm/md/lg` | `4 / 6 / 8` |
| `background-muted` | `#eae0e2` | | `space-xs..xl` | `4 / 8 / 16 / 24 / 32` |
| `chart-1..5` | `#7a2e42 → #995a67 → #b6858e → #d3b2b7 → #efe0e3` | | | |

## Responsive navigation

Three shells off one nav-data source (PRD §5.3):

| Breakpoint | Shell |
|---|---|
| Desktop (≥1280px) | Persistent right-edge **Sidebar**, full labels |
| Tablet (≥768px) | Collapsed **Tablet Rail** — same items, icon-only |
| Mobile (<768px) | **Bottom Nav Bar** (4 primary items) + **Drawer Menu** for overflow (Clients, Payments, Reports, Settings) |

## Screens

### Desktop (1440px)

Dashboard · Cases List · Clients List · Client Detail · Hearings & Calendar ·
Missions Board · Payments · Reports

**Case File detail** (the load-bearing tabbed pattern — one case, 5 tabs, every module attaches here):

Parties · Documents · Hearings · Missions · Payments

### Mobile (390px)

Dashboard · Cases List · Case Detail · Calendar (agenda view, not the desktop
grid) · Missions (stacked sections, not columns) · Payments · Clients List

### Tablet (834px)

Dashboard · Cases List · Case Detail · Calendar (per-lawyer grid retained) ·
Missions (Kanban retained, narrower) · Payments

### Flows (the interactions, not just the pages)

- **New Case intake** (secretary's under-3-minute target): Basics → Parties →
  Review & Create
- **Record Payment** (the highest-liability flow): Case summary → Method →
  Confirm & receipt
- **Schedule Hearing** — conflict warning surfaces **inline**, not as a separate
  report, per IMPLEMENTATION_PLAN.md §4
- **Add Party** · **Upload Document**

### Overlays

Notifications popover · Search command palette (fuzzy-match highlighting on
results)

### Empty states

Cases · Clients · Missions · Payments — calm, single icon, no mascots, always a
CTA.

### AI Assistant
A **persistent floating orb**, bottom-left corner on every screen (RTL-mirrored from the reference product's LTR corner convention) — not a routed page. See PRD §5.5 for why this doesn't contradict "not a bolt-on chatbot."

Four states, each visually distinct: Idle · Listening · Speaking · Thinking

Opens into: Chat panel (desktop, docked) · Chat panel (mobile, sheet) · Voice —
listening · Voice — speaking

## Generating static exports

`des.pen` only flushes its full state to disk on the *next* live edit after
opening. If the file looks stale or empty when opened fresh, make a trivial edit
through the Pencil tools first. Then run `mcp__pencil__export_nodes` against the
required nodes; names are stable, but confirm current IDs with
`get_editor_state` after design changes.
