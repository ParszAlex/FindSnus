/**
 * Compliance footer. Carries the non-negotiable framing from PRODUCT.md:
 * 18+ only, tobacco-free pouches only, this is an information tool and not a
 * shop, no health claims. Kept to plain factual copy — no dead nav links, no
 * promotion. The nicotine-addiction warning line is intentionally omitted for
 * now (to be added once legal copy is finalised).
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:py-3">
        {/* Mobile-only compact single-line version */}
        <p className="text-xs text-muted sm:hidden">
          18+ only · Tobacco-free pouches · Not a shop · © {new Date().getFullYear()} findsnus
        </p>
        {/* Full compliance text, hidden on mobile */}
        <p className="hidden text-xs leading-relaxed text-muted sm:block">
          <span className="font-semibold text-ink">For adults 18 and over.</span>{" "}
          findsnus lists shops selling tobacco-free nicotine pouches for legal
          sale in the UK — an information tool, not a shop. We sell nothing and
          make no health claims. Traditional snus is banned for UK sale and is
          not listed here.
        </p>
        <p className="hidden shrink-0 text-xs text-muted sm:block">
          © {new Date().getFullYear()} findsnus
        </p>
      </div>
    </footer>
  );
}
