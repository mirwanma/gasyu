import "server-only";
import { createClient } from "@/lib/supabase/server";
import { filterTerm } from "@/lib/safe-url";

// Kota/kabupaten untuk pemilih wilayah. active = kota sudah dibuka di Gasyu.
export type CityChoice = { id: string; name: string; province: string | null; active: boolean };

// Kecamatan beserta kotanya, untuk mengisi awal pemilih wilayah dan menampilkan label.
export type DistrictInfo = { districtId: string; districtName: string; cityId: string; cityName: string; cityActive: boolean };

export async function listCityChoices(): Promise<CityChoice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, name, province_name, is_active")
    .eq("level", "city")
    .order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, province: c.province_name, active: c.is_active }));
}

export async function getDistrictInfo(districtId: string | null): Promise<DistrictInfo | null> {
  if (!districtId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, name, city:parent_id(id, name, is_active)")
    .eq("id", districtId)
    .eq("level", "district")
    .maybeSingle();
  const city = Array.isArray(data?.city) ? data.city[0] : data?.city;
  if (!data || !city) return null;
  return { districtId: data.id, districtName: data.name, cityId: city.id, cityName: city.name, cityActive: city.is_active };
}

// Pilihan wilayah cakupan aktivitas dan open call: kota yang sudah dibuka beserta kecamatannya.
export type ScopeCity = { id: string; name: string; districts: { id: string; name: string }[] };

export async function listScopeOptions(): Promise<ScopeCity[]> {
  const supabase = await createClient();
  const { data: cities } = await supabase.from("regions").select("id, name").eq("level", "city").eq("is_active", true).order("name");
  if (!cities?.length) return [];
  const { data: districts } = await supabase
    .from("regions")
    .select("id, name, parent_id")
    .eq("level", "district")
    .eq("is_active", true)
    .in("parent_id", cities.map((c) => c.id))
    .order("name");
  return cities.map((c) => ({
    id: c.id,
    name: c.name,
    districts: (districts ?? []).filter((d) => d.parent_id === c.id).map((d) => ({ id: d.id, name: d.name })),
  }));
}

// Admin: kota beserta jumlah warga dan penyelenggara (v_admin_city_stats).
export type CityStats = { city_id: string; name: string; province_name: string | null; is_active: boolean; citizens: number; organizers: number; pending_organizers: number };

export async function listCityStats(opts: { q?: string } = {}): Promise<CityStats[]> {
  const supabase = await createClient();
  let query = supabase.from("v_admin_city_stats").select("*").order("name");
  if (opts.q) query = query.ilike("name", `%${filterTerm(opts.q)}%`).limit(30);
  else query = query.or("is_active.eq.true,citizens.gt.0,organizers.gt.0");
  const { data } = await query;
  return (data ?? []) as CityStats[];
}
