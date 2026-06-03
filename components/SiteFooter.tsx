/**
 * Compliance footer. Carries the non-negotiable framing from PRODUCT.md:
 * 18+ only, tobacco-free pouches only, this is an information tool and not a
 * shop, no health claims. Kept to plain factual copy — no dead nav links, no
 * promotion. The nicotine-addiction warning line is intentionally omitted for
 * now (to be added once legal copy is finalised).
 */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <p className="text-sm font-medium text-ink">For adults 18 and over.</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          findsnus lists shops that sell tobacco-free nicotine pouches for legal
          sale in the UK. It is an information tool, not a shop: we do not sell
          anything and make no health claims. Traditional snus is banned for UK
          sale and is not listed here.
        </p>
        <p className="mt-5 text-xs text-muted">
          © {new Date().getFullYear()} findsnus
        </p>
      </div>
    </footer>
  );
}
