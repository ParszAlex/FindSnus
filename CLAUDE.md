# findsnus

UK cross-brand nicotine pouch store locator. Users enter a postcode or share location and see which physical shops near them stock which brands (Killa, Pablo, VELO, ZYN, etc.) and at what price. Crowdsourced data, map-first UI.

This is a portfolio project. Code quality and clean git history matter as much as features — a reviewer will read this repo.

## Stack (locked — do not change without asking)

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (Postgres + PostGIS for geo queries)
- **Map:** MapLibre GL — user-approved swap from Leaflet on 2026-06-06 (cartoon vector basemap on Stadia Maps tiles)
- **Deploy:** Vercel
- **Package manager:** pnpm

## Hard rules

1. **Do not add dependencies, dev tools, or skills without flagging it first.** State what, why, and what it costs. Wait for my yes. No exceptions — this includes testing libraries, UI kits, ORMs, and analytics.
2. **No premature infrastructure.** Don't add testing setup, CI, monorepo config, or auth before the feature that needs it exists.
3. **Don't reach for training-data defaults.** This stack is 2026. If unsure about a current pattern, say so or check docs — don't guess from older conventions.
4. **One feature per task.** Build it, make it independently testable, stop. Don't bundle unrelated changes.
5. **Never commit secrets.** Supabase keys go in `.env.local` (gitignored). Use `NEXT_PUBLIC_` prefix only for keys safe to expose client-side.

## Conventions

- App Router only — no `pages/` directory.
- Server Components by default; `"use client"` only when interactivity requires it.
- Components in `components/`, one per file, PascalCase.
- Supabase client in `lib/supabase.ts`, typed.
- Keep `page.tsx` files thin — logic lives in components or `lib/`.

## Compliance (non-negotiable — this is a real product)

- Tobacco-free nicotine pouches only. Traditional snus is banned for UK sale — never imply otherwise.
- Age gate (18+) on entry.
- No health claims, no promotion of nicotine use. Locator tool only.
- No personal data collection beyond hashed IPs for spam prevention (GDPR).

## Session log

At the end of every task, append an entry to `SESSION_LOG.md`:

```
## [date] — [task name]
- What changed: ...
- Why: ...
- Unsure about / flagged for review: ...
- What I'd do differently: ...
```

This is for human review. Be honest about what you were unsure of — that is the most useful part.
