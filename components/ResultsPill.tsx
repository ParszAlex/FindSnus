"use client";

// Bottom-centre status pill: how many shops match in the current radius, plus a
// (stubbed) toggle to a future list view. Reads loading/error so the locator has
// one calm status surface instead of scattering spinners across the chrome.

type Props = {
  count: number;
  radiusMi: number;
  loading: boolean;
  error: boolean;
  /** Whether the left-side list drawer is open (drives the button's state). */
  listOpen: boolean;
  /** Toggle the list drawer open/closed. */
  onToggleList: () => void;
};

export default function ResultsPill({
  count,
  radiusMi,
  loading,
  error,
  listOpen,
  onToggleList,
}: Props) {
  const radiusLabel = `${radiusMi} ${radiusMi === 1 ? "mile" : "miles"}`;

  return (
    <div className="absolute bottom-[22px] left-1/2 z-[var(--z-sticky)] inline-flex -translate-x-1/2 items-center gap-[9px] rounded-full bg-ink py-[9px] pr-2 pl-4 text-sm text-bg shadow-pill">
      {error ? (
        <span>Couldn’t load shops</span>
      ) : loading ? (
        <span>Searching nearby…</span>
      ) : (
        <span>
          <b className="font-bold">
            {count} {count === 1 ? "shop" : "shops"}
          </b>{" "}
          within {radiusLabel}
        </span>
      )}

      <button
        type="button"
        onClick={onToggleList}
        aria-pressed={listOpen}
        aria-expanded={listOpen}
        className={`inline-flex items-center gap-1.5 rounded-full px-[13px] py-1.5 text-xs font-semibold text-bg transition-colors ${
          listOpen ? "bg-white/[0.30]" : "bg-white/[0.14] hover:bg-white/[0.24]"
        }`}
      >
        <ListIcon />
        List view
      </button>
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
