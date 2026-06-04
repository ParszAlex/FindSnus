"use client";

// TEMPORARY — merged data-shape proof (step 2 of 4, data layer → UI).
// Proves: nearby_shops (shops + distance_m) joined client-side to their listings
// (brand name / strength / price) via a second PostgREST query with FK embedding.
// nearby_shops is unchanged from step 1 (commit 7900d47) — it returns no listings
// by design; the join happens here in the client. Delete this route once the real
// locator UI consumes this shape.

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Airdrie centre — same hardcoded coord as step 1. RPC param keys must match the
// SQL signature exactly (in_lat, in_lng, in_radius_km).
const IN_LAT = 55.8657;
const IN_LNG = -3.9803;

// nearby_shops return shape (shop columns + distance_m, no listings).
type ShopRow = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  verified: boolean;
  distance_m: number;
};

// listings row with the brand name embedded via the brand_id → brands FK.
// A listing belongs to one brand, so PostgREST returns `brands` as a single object.
type ListingRow = {
  shop_id: string;
  strength_mg: number;
  price: number;
  last_confirmed_at: string;
  source: string;
  brands: { name: string } | null;
};

// What we actually want per shop: brand NAME, strength, price.
type MergedShop = ShopRow & {
  listings: { brand: string | null; strength_mg: number; price: number }[];
};

export default function RpcTestPage() {
  const [data, setData] = useState<MergedShop[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      // 1. Nearest shops + distance (proven in step 1).
      const { data: shopsData, error: shopsError } = await supabase.rpc(
        "nearby_shops",
        { in_lat: IN_LAT, in_lng: IN_LNG, in_radius_km: 10 },
      );
      if (shopsError || !shopsData) {
        console.log("nearby_shops error:", shopsError);
        setError(shopsError ?? new Error("no shops returned"));
        return;
      }
      const shops = shopsData as ShopRow[];

      // 2. Listings for just those shops, brand name embedded via FK.
      const shopIds = shops.map((s) => s.id);
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select(
          "shop_id, strength_mg, price, last_confirmed_at, source, brands(name)",
        )
        .in("shop_id", shopIds);
      if (listingsError || !listingsData) {
        console.log("listings error:", listingsError);
        setError(listingsError ?? new Error("no listings returned"));
        return;
      }
      const listings = listingsData as unknown as ListingRow[];

      // 3. Merge client-side: group listings by shop_id, nest under each shop.
      const byShop = new Map<string, ListingRow[]>();
      for (const l of listings) {
        const group = byShop.get(l.shop_id) ?? [];
        group.push(l);
        byShop.set(l.shop_id, group);
      }
      const merged: MergedShop[] = shops.map((s) => ({
        ...s,
        listings: (byShop.get(s.id) ?? []).map((l) => ({
          brand: l.brands?.name ?? null,
          strength_mg: l.strength_mg,
          price: l.price,
        })),
      }));

      console.log("merged data:", merged);
      console.log("error:", null);
      setData(merged);
      setError(null);
    }

    run();
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
