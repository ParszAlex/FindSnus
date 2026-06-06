type WordmarkProps = {
  /** Extra classes for the wrapper (spacing/sizing at the call site). */
  className?: string;
};

/**
 * findsnus wordmark: the cartoon pouch sachet (the same asset the map markers
 * use) followed by the lowercase name. Decorative, so the mark is aria-hidden
 * and the text carries the accessible name.
 */
export default function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-ink ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 11KB static asset, no optimisation needed */}
      <img
        src="/pouch-marker.png"
        alt=""
        width={22}
        height={9}
        draggable={false}
        aria-hidden="true"
        className="h-auto w-[22px] shrink-0 select-none"
      />
      <span className="text-[1.0625rem] font-bold tracking-[-0.02em] leading-none">
        findsnus
      </span>
    </span>
  );
}
