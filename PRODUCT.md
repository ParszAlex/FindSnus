# Product

## Register

product

> Mixed surface: the map-first locator is the primary product, but a marketing
> landing page carries equal weight in selling the idea. `product` is the
> default register; treat the landing/home hero as a `brand` task when working
> on it specifically.

## Users

UK adults (18+) who already use tobacco-free nicotine pouches and want to know
which physical shops near them stock a specific brand, and at what price. They
arrive with intent ("where can I buy Killa / VELO / ZYN near me?"), often on a
phone, often on the move. Some arrive to *contribute* data (report a shop's
stock or price). The context is quick, in-the-moment lookup, not browsing.

Secondary: first-time visitors arriving from search or social who need to
understand what the tool does in seconds before they'll enter a postcode.

## Product Purpose

A cross-brand, crowdsourced store locator for tobacco-free nicotine pouches in
the UK. Enter a postcode or share location, see nearby shops on a map with the
brands they stock and prices reported by other users. It exists because no
single retailer or brand shows cross-brand availability at the shop level;
that information currently lives in people's heads. Success is a user finding a
real, in-stock shop near them in under a minute, and trusting the data enough
to make the trip.

## Brand Personality

Calm, precise, legitimate. Three words: **clinical, trustworthy, unfussy.**

The voice is plain and factual, never promotional. It reads like a transit map
or a pharmacy wayfinding sign, not a lifestyle brand. Legitimacy is the core
emotional goal: this is a real, legal product operating in a heavily regulated
category, and the interface should make a sceptical user feel they've landed on
something credible and above-board, not a grey-market vape site. Restraint and
clarity do that work, not loud color or personality.

## Anti-references

- **Sketchy vape-shop aesthetic.** No neon, no dark/gritty "vape culture"
  styling, no lightning bolts, smoke, or flavour-cloud graphics. This is the
  single most important thing to avoid; it reads as dodgy and grey-market.
- **Big Tobacco corporate.** No cold, lawyered navy-and-gold corporate tobacco
  branding. Legitimate does not mean stiff or impersonal.
- **Generic SaaS template.** No purple gradients, hero-metric blocks, identical
  feature-card grids, or cream-bg startup landing look.
- **Anything that glamorises nicotine.** No aspirational lifestyle imagery, no
  "cool", no implied health/energy/wellness benefit. This is a neutral locator
  tool, compliance-first. (See `CLAUDE.md` Compliance section.)

## Design Principles

1. **Compliance is the design, not a disclaimer.** Age gate, neutral framing,
   and the absence of glamour are built into the interface, not bolted on as
   fine print. The product looks legal because it is.
2. **The tool disappears into the task.** Map-first. The shortest path from
   landing to "shops near me" wins. Minimal chrome, no decoration competing
   with the data the user came for.
3. **Trust through understatement.** Pharmacy-grade calm and clinical clarity
   are the legitimacy signal. When a choice is between louder and quieter,
   quieter is almost always right here.
4. **Crowdsourced, but credible.** The data comes from users, so its
   trustworthiness must be visible: surface freshness, provenance, and
   confidence so a reported price/stock reads as accountable, not random.
5. **Portfolio-grade craft.** A reviewer will read this repo. Honest empty,
   loading, and error states; consistent component vocabulary; legible at a
   glance. No half-finished states shipped.

## Accessibility & Inclusion

No formal WCAG conformance target has been set for this stage. Baseline craft
defaults still apply throughout: body-text contrast at or above 4.5:1, visible
focus states, keyboard operability for core flows, and a
`prefers-reduced-motion` alternative for every animation. The 18+ age gate is a
compliance requirement (not an accessibility feature) but is the first
interactive surface, so it must be fully keyboard-operable and legible.

When the map is built, revisit accessibility deliberately: a map of pins is the
likeliest place to exclude keyboard and screen-reader users, so plan a
non-visual fallback (e.g. an accompanying results list) rather than retrofitting
one. Do not encode brand or stock status by color alone.
