import { supabase } from "@/integrations/supabase/client";
import type { Place } from "@/lib/weather";

export async function fetchCloudPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from("saved_places")
    .select("name, country, lat, lon")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ name: r.name, country: r.country, lat: r.lat, lon: r.lon }));
}

// Replace the user's cloud list with the given ordered list.
export async function pushCloudPlaces(userId: string, places: Place[]) {
  const { error: delErr } = await supabase.from("saved_places").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  if (places.length === 0) return;
  const { error } = await supabase.from("saved_places").insert(
    places.map((p, i) => ({
      user_id: userId,
      name: p.name,
      country: p.country ?? "",
      lat: p.lat,
      lon: p.lon,
      position: i,
    })),
  );
  if (error) throw error;
}
