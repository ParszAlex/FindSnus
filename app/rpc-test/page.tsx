"use client";

// TEMPORARY — merged data-shape proof (step 2 of 4, data layer → UI).
// The fetch + client-side listings-join + nest logic now lives in
// `lib/shops.ts` (getNearbyShopsWithListings); this page just dumps its result
// to prove the move changed nothing. Delete this route once the locator UI is
// settled (the list at app/ already consumes the same function).

import { useEffect, useState } from "react";
import { getNearbyShopsWithListings, type ShopWithListings } from "@/lib/shops";

// Airdrie centre — same hardcoded coord as steps 1–2.
const IN_LAT = 55.8657;
const IN_LNG = -3.9803;

export default function RpcTestPage() {
  const [data, setData] = useState<ShopWithListings[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    getNearbyShopsWithListings(IN_LAT, IN_LNG, 10)
      .then((shops) => {
        console.log("merged data:", shops);
        console.log("error:", null);
        setData(shops);
        setError(null);
      })
      .catch((e) => {
        console.log("error:", e);
        setError(e);
      });
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>nearby_shops + listings (merged) test</h1>
      <p>
        in_lat={IN_LAT}, in_lng={IN_LNG}, in_radius_km=10
      </p>
      <h2>data</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <h2>error</h2>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </main>
  );
}
