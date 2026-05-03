// Distance + weight-based delivery fee.
// fee = base + perKm * km + perKg * total_kg, rounded to 2dp, min = base.
const BASE = 3;     // RM
const PER_KM = 1.0; // RM per km
const PER_KG = 0.2; // RM per kg

export function haversineKm(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function calcDeliveryFee(opts: { distanceKm: number | null; totalKg: number }): { fee: number; distanceKm: number | null; totalKg: number; breakdown: { base: number; distance: number; weight: number } } {
  const km = opts.distanceKm ?? 5; // fallback 5km when coords missing
  const distance = PER_KM * km;
  const weight = PER_KG * opts.totalKg;
  const fee = Math.max(BASE, BASE + distance + weight);
  return {
    fee: Math.round(fee * 100) / 100,
    distanceKm: opts.distanceKm,
    totalKg: opts.totalKg,
    breakdown: { base: BASE, distance: Math.round(distance * 100) / 100, weight: Math.round(weight * 100) / 100 },
  };
}

export const DELIVERY_RATE = { BASE, PER_KM, PER_KG };
