import PostcodeSearch from "./PostcodeSearch";
import Wordmark from "./Wordmark";

/**
 * Landing hero. Single-fold, left-aligned wayfinding composition: wordmark,
 * factual headline, one-line subtag, and the postcode search as the visual
 * centerpiece. No imagery by design — the brand is a neutral locator, and
 * lifestyle imagery is explicitly out of bounds (see PRODUCT.md).
 */
export default function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col px-6 pb-16 pt-10 sm:pt-16">
      <header className="animate-rise" style={{ animationDelay: "0ms" }}>
        <Wordmark />
      </header>

      <div className="mt-16 sm:mt-24">
        <h1
          className="animate-rise text-balance text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl"
          style={{ animationDelay: "80ms" }}
        >
          Find the shops near you that stock your brand.
        </h1>

        <p
          className="animate-rise mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted"
          style={{ animationDelay: "160ms" }}
        >
          Cross-brand nicotine pouch availability and prices across the UK,
          reported by the people who actually shop there.
        </p>

        <div
          className="animate-rise mt-9"
          style={{ animationDelay: "240ms" }}
        >
          <PostcodeSearch />
        </div>
      </div>
    </section>
  );
}
