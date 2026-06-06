"use client";

// Floating top-right brand filter. The brand universe is derived upstream (in
// <Locator>) from the shops actually returned, so this only renders chips and
// reports toggles back up via `onChange`. A shop stays visible while it stocks
// any active brand; toggling all off is allowed (the map simply empties).

type Props = {
  brands: string[];
  active: Set<string>;
  onChange: (next: Set<string>) => void;
};

export default function BrandFilter({ brands, active, onChange }: Props) {
  function toggle(brand: string) {
    const next = new Set(active);
    if (next.has(brand)) {
      next.delete(brand);
    } else {
      next.add(brand);
    }
    onChange(next);
  }

  return (
    <section
      aria-label="Filter by brand"
      className="pointer-events-auto w-full rounded-2xl border border-border bg-bg px-[14px] pt-[13px] pb-[14px] shadow-float sm:w-[246px]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.03em] text-muted uppercase">
          Filter by brand
        </span>
        <span className="text-xs text-muted">{active.size} active</span>
      </div>

      <div className="flex flex-wrap gap-[7px]">
        {brands.map((brand) => {
          const pressed = active.has(brand);
          return (
            <button
              key={brand}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(brand)}
              className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-[11px] text-sm font-medium whitespace-nowrap transition-colors ${
                pressed
                  ? "border border-primary bg-primary text-on-primary"
                  : "border border-border bg-bg text-ink hover:border-border-strong"
              }`}
            >
              <span
                className={`size-[7px] rounded-full ${
                  pressed ? "bg-on-primary" : "bg-muted"
                }`}
                aria-hidden="true"
              />
              {brand}
            </button>
          );
        })}
      </div>
    </section>
  );
}
