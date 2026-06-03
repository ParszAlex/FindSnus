type WordmarkProps = {
  /** Render size of the pin mark in pixels. Wordmark text scales separately. */
  className?: string;
};

/**
 * findsnus wordmark: a geometric location pin (map-key style) followed by the
 * lowercase name. The pin reads as wayfinding, not "vape culture". Decorative,
 * so the mark is aria-hidden and the text carries the accessible name.
 */
export default function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-ink ${className ?? ""}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M12 22c4.5-5.2 7-9 7-12.4A7 7 0 1 0 5 9.6C5 13 7.5 16.8 12 22Z"
          fill="var(--color-primary)"
        />
        <circle cx="12" cy="9.4" r="2.6" fill="var(--color-on-primary)" />
      </svg>
      <span className="text-[1.0625rem] font-bold tracking-[-0.02em] leading-none">
        findsnus
      </span>
    </span>
  );
}
