"use client";

import { useState } from "react";

/**
 * Postcode entry for the locator. UI only at this stage: there is no submit
 * logic, no geocoding, and no results — the form intentionally does nothing
 * on submit beyond preventing a page reload. State coverage (focus, hover,
 * filled, empty) is real so this slots straight into the eventual search flow.
 */
export default function PostcodeSearch() {
  const [postcode, setPostcode] = useState("");

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="w-full max-w-md"
    >
      <label
        htmlFor="postcode"
        className="block text-sm font-medium text-ink mb-2"
      >
        Your postcode
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="postcode"
          name="postcode"
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          placeholder="e.g. SW1A 1AA"
          value={postcode}
          onChange={(event) => setPostcode(event.target.value.toUpperCase())}
          aria-describedby="postcode-hint"
          className="h-12 flex-1 rounded-lg border border-border bg-bg px-4 text-base text-ink tracking-wide transition-colors placeholder:tracking-normal hover:border-ink/30 focus:border-primary focus-visible:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-hover active:translate-y-px sm:px-6"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Find shops
        </button>
      </div>

      <p id="postcode-hint" className="mt-2 text-sm text-muted">
        Enter a UK postcode to see nearby shops and the brands they stock.
      </p>
    </form>
  );
}
