"use client";

import { useCallback, useEffect, useState } from "react";

// MobileSearchPill reads nothing from this — the hint owns its own persistence,
// same pattern as AgeGate owning its storage key. The "-v2" suffix re-shows
// the hint for early users whose v1 flag was set by an accidental map tap
// (v1 dismissed on any tap, including map drags).
export const HINT_STORAGE_KEY = "findsnus:location-hint-dismissed-v2";

// Elements carrying this attribute count as "acting on the hint" — tapping
// them dismisses it permanently. Everything else (map drags, zoom taps)
// leaves the hint alone.
export const HINT_DISMISS_ATTR = "data-location-hint-dismiss";

const SHOW_DELAY_MS = 700; // let the age gate close and the map paint first
const AUTO_HIDE_MS = 12000;

/**
 * One-time coach mark pointing at the GPS button in the mobile search pill.
 * The mobile location button is icon-only, so first-time visitors get a short
 * nudge that tapping it finds shops near them — and that the browser only asks
 * for location permission on that tap, never on load.
 *
 * Dismissal rules: the X, Escape, or tapping a HINT_DISMISS_ATTR element (the
 * GPS button) persists the flag — the user has seen and acted past it. Map
 * taps and drags do NOT dismiss; the auto-hide only hides for this visit, so
 * a visitor who never acted on the hint gets it again next time.
 */
export default function LocationHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(HINT_STORAGE_KEY) === "true") return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(HINT_STORAGE_KEY, "true");
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    // Capture phase so a tap on the GPS button both dismisses the hint and
    // fires geolocation in one go, without any preventDefault games. Only
    // opt-in elements dismiss — map taps/drags must not kill the hint.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(`[${HINT_DISMISS_ATTR}]`)
      ) {
        dismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="animate-rise pointer-events-auto relative self-end rounded-[14px] border border-black/[0.08] bg-white/[0.94] py-2 pl-3 pr-2 shadow-[0_2px_10px_rgba(0,0,0,0.13),0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-surface/[0.92]"
    >
      {/* Caret pointing up at the centre of the 44px GPS button: the button's
          centre sits 22px in from the container's right edge, and the 12px
          rotated square's left edge lands at 22 − 6 = 16px (right-4). */}
      <span
        aria-hidden="true"
        className="absolute -top-[5px] right-4 size-3 rotate-45 border-l border-t border-black/[0.08] bg-white/[0.94] dark:border-white/[0.10] dark:bg-surface/[0.92]"
      />
      <span className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-ink">
          Use your location from here
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tip"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted"
        >
          <CloseIcon />
        </button>
      </span>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
