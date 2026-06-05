"use client";

import { useEffect, useState } from "react";
import AgeGate, { STORAGE_KEY } from "@/components/AgeGate";
import Locator from "@/components/Locator";

// The home page IS the locator, gated behind the existing 18+ AgeGate. We read
// the same localStorage key the gate writes and only mount <Locator /> once it's
// confirmed — so an unconfirmed visitor's DOM contains no shop/brand data at all
// (absent, not merely hidden). The gate keeps full ownership of the key/logic.
export default function Home() {
  // null = still reading storage; render nothing so the locator never flashes
  // and there's no server/client hydration mismatch.
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    const isConfirmed = () =>
      window.localStorage.getItem(STORAGE_KEY) === "true";

    if (isConfirmed()) {
      setConfirmed(true);
      return;
    }
    setConfirmed(false);

    // The AgeGate writes the key in THIS tab, where the `storage` event does not
    // fire — so poll for the transition while unconfirmed. `storage` covers the
    // cross-tab case. Both stop as soon as confirmation is seen.
    const poll = window.setInterval(() => {
      if (isConfirmed()) {
        setConfirmed(true);
        window.clearInterval(poll);
      }
    }, 200);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue === "true") {
        setConfirmed(true);
        window.clearInterval(poll);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (confirmed === null) return null;
  return confirmed ? <Locator /> : <AgeGate />;
}
