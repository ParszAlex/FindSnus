import { createClient } from "@/utils/supabase/client";

// A shop as returned by the nearby_shops RPC: the shop columns plus distance_m.
export type Shop = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  verified: boolean;
  distance_m: number;
};

// What a consumer needs per listing: brand NAME (resolved via FK), strength, price.
export type Listing = {
  brand: string | null;
  strength_mg: number;
  price: number;
};

// The §4 shape: shop columns + distance_m + its listings.
export type ShopWithListings = Shop & { listings: Listing[] };

// Raw listings row with the brand name embedded via the brand_id → brands FK.
// A listing belongs to one brand, so PostgREST returns `brands` as a single object.
type ListingRow = {
  shop_id: string;
  strength_mg: number;
  price: number;
  last_confirmed_at: string;
  source: string;
  brands: { name: string } | null;
};

// Nearest shops within radiusKm of (lat, lng), each with its listings nested.
// Shops stay in the RPC's distance-ascending order. The shops↔listings join is
// done client-side (two queries) because nearby_shops returns shops only by design.
export async function getNearbyShopsWithListings(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ShopWithListings[]> {
  const supabase = createClient();

  // 1. Nearest shops + distance.
  const { data: shopsData, error: shopsError } = await supabase.rpc("nearby_shops", {
    in_lat: lat,
    in_lng: lng,
    in_radius_km: radiusKm,
  });
  if (shopsError) throw shopsError;
  const shops = (shopsData ?? []) as Shop[];
  if (shops.length === 0) return [];

  // 2. Listings for just those shops, brand name embedded via FK.
  const shopIds = shops.map((s) => s.id);
  const { data: listingsData, error: listingsError } = await supabase
    .from("listings")
    .select("shop_id, strength_mg, price, last_confirmed_at, source, brands(name)")
    .in("shop_id", shopIds);
  if (listingsError) throw listingsError;
  const listings = (listingsData ?? []) as unknown as ListingRow[];

  // 3. Merge: group listings by shop_id, nest under each shop, preserve RPC order.
  const byShop = new Map<string, Listing[]>();
  for (const l of listings) {
    const group = byShop.get(l.shop_id) ?? [];
    group.push({ brand: l.brands?.name ?? null, strength_mg: l.strength_mg, price: l.price });
    byShop.set(l.shop_id, group);
  }
  return shops.map((s) => ({ ...s, listings: byShop.get(s.id) ?? [] }));
}
