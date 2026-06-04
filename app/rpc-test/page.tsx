"use client";

// TEMPORARY — RPC wiring proof (step 1 of 4, data layer → UI).
// Confirms the browser client can call the `nearby_shops` RPC and get rows back.
// Hardcoded Airdrie-centre coords so the only unknown under test is the RPC call.
// Delete this route once the real locator UI consumes nearby_shops.

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Airdrie centre. Param keys MUST match the SQL signature exactly
// (in_lat, in_lng, in_radius_km) — a wrong key yields a silent null, not an error.
const IN_LAT = 55.8657;
const IN_LNG = -3.9803;

export default function RpcTestPage() {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("nearby_shops", { in_lat: IN_LAT, in_lng: IN_LNG, in_radius_km: 10 })
      .then(({ data, error }) => {
        console.log("nearby_shops data:", data);
        console.log("nearby_shops error:", error);
        setData(data);
        setError(error);
      });
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>nearby_shops RPC test</h1>
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
