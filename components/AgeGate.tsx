"use client";

import { useEffect, useRef, useState } from "react";
import Wordmark from "./Wordmark";

// The home page reads this same key to decide whether to mount the locator, so
// it's exported here to keep a single source of truth (the gate still owns it).
export const STORAGE_KEY = "findsnus:age-confirmed";

type Status = "checking" | "asking" | "blocked" | "confirmed";

/**
 * 18+ age gate. Rendered as the first interactive surface and covers all page
 * content until the visitor confirms. The choice is persisted to localStorage
 * so returning visitors aren't re-prompted. Under-18 is a hard block (no path
 * forward, no external redirect) with a way back in case of a misclick.
 *
 * Starts in "checking" so unconfirmed content is never briefly exposed; on
 * mount we read storage and either dismiss (confirmed) or show the question.
 */
export default function AgeGate() {
  const [status, setStatus] = useState<Status>("checking");
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Resolve persisted state after mount (localStorage is client-only).
  useEffect(() => {
    const confirmed =
      typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY) === "true";
    setStatus(confirmed ? "confirmed" : "asking");
  }, []);

  const gateOpen = status === "asking" || status === "blocked";

  // Lock body scroll while the gate is open.
  useEffect(() => {
    if (!gateOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [gateOpen]);

  // Move focus into the dialog and trap Tab within it.
  useEffect(() => {
    if (!gateOpen) return;
    confirmButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [gateOpen, status]);

  function confirm() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setStatus("confirmed");
  }

  if (status === "checking" || status === "confirmed") return null;

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-ink/55 p-5"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-body"
        className="w-full max-w-md rounded-2xl border border-border bg-bg p-7 sm:p-8 shadow-lg"
      >
        <Wordmark className="mb-6" />

        {status === "asking" ? (
          <>
            <h1
              id="age-gate-title"
              className="text-2xl font-bold tracking-tight text-ink text-balance"
            >
              Are you 18 or over?
            </h1>
            <p id="age-gate-body" className="mt-3 text-base text-muted">
              findsnus helps you locate shops that sell tobacco-free nicotine
              pouches. These products are for adults only, so we need to confirm
              your age before you continue.
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={confirm}
                className="h-12 rounded-lg bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover active:translate-y-px"
              >
                Yes, I am 18 or over
              </button>
              <button
                type="button"
                onClick={() => setStatus("blocked")}
                className="h-12 rounded-lg border border-border bg-bg px-5 font-medium text-ink transition-colors hover:border-ink/30 hover:bg-surface"
              >
                No, I am under 18
              </button>
            </div>
          </>
        ) : (
          <>
            <h1
              id="age-gate-title"
              className="text-2xl font-bold tracking-tight text-ink text-balance"
            >
              You need to be 18 or over
            </h1>
            <p id="age-gate-body" className="mt-3 text-base text-muted">
              Sorry, findsnus is only available to adults aged 18 and over. You
              cannot use this site yet. Please come back when you are old
              enough.
            </p>

            <button
              type="button"
              onClick={() => setStatus("asking")}
              className="mt-7 h-11 rounded-lg border border-border bg-bg px-5 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-surface"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
