export type Place = { name: string; country?: string; lat: number; lon: number };

export type Weather = {
  place: Place;
  fetchedAt: number;
  current: { temp: number; code: number; wind: number; feels: number; is_day?: number; humidity?: number };
  hourly: { time: string; temp: number; code: number; rain?: number }[];
  daily: {
    date: string; max: number; min: number; code: number;
    rain?: number; sunrise?: string; sunset?: string; uv?: number; precip?: number;
  }[];
  periods?: Period[];
};

export type Period = { label: "Day" | "Night"; code: number; high: number; low: number; rain: number; wind: number };

function summarize(label: Period["label"], items: { temp: number; code: number; rain: number; wind: number }[]): Period | null {
  if (!items.length) return null;
  return {
    label,
    code: Math.max(...items.map((x) => x.code)),
    high: Math.max(...items.map((x) => x.temp)),
    low: Math.min(...items.map((x) => x.temp)),
    rain: Math.max(...items.map((x) => x.rain)),
    wind: Math.max(...items.map((x) => x.wind)),
  };
}

const CACHE_KEY = "weather:last";

export function loadCached(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Weather) : null;
  } catch {
    return null;
  }
}

export async function searchCity(q: string): Promise<Place[]> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&format=json`,
  );
  if (!r.ok) throw new Error("Search failed");
  const j = await r.json();
  return (j.results ?? []).map((x: any) => ({
    name: x.admin1 && x.admin1 !== x.name ? `${x.name}, ${x.admin1}` : x.name,
    country: x.country,
    lat: x.latitude,
    lon: x.longitude,
  }));
}

export async function fetchWeather(place: Place): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,relative_humidity_2m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,precipitation_sum` +
    `&timezone=auto&forecast_days=7`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather request failed");
  const j = await r.json();
  const today: string = j.daily.time[0];
  const tomorrow: string = j.daily.time[1];
  const all = j.hourly.time.map((t: string, i: number) => ({
    time: t,
    temp: j.hourly.temperature_2m[i],
    code: j.hourly.weather_code[i],
    rain: j.hourly.precipitation_probability?.[i] ?? 0,
    wind: j.hourly.wind_speed_10m?.[i] ?? 0,
  }));
  const hourly = all
    .filter((h: { time: string }) => h.time.startsWith(today))
    .map(({ time, temp, code, rain }: any) => ({ time, temp, code, rain }));
  const hr = (t: string) => +t.slice(11, 13);
  // Day: 06–18 today. Night: 18–24 today + 00–06 tomorrow.
  const day = summarize("Day", all.filter((h: any) => h.time.startsWith(today) && hr(h.time) >= 6 && hr(h.time) < 18));
  const night = summarize(
    "Night",
    all.filter(
      (h: any) => (h.time.startsWith(today) && hr(h.time) >= 18) || (h.time.startsWith(tomorrow) && hr(h.time) < 6),
    ),
  );
  const periods = [day, night].filter(Boolean) as Period[];
  const w: Weather = {
    place,
    fetchedAt: Date.now(),
    current: {
      temp: j.current.temperature_2m,
      feels: j.current.apparent_temperature,
      code: j.current.weather_code,
      wind: j.current.wind_speed_10m,
      is_day: j.current.is_day,
      humidity: j.current.relative_humidity_2m,
    },
    hourly,
    periods,
    daily: j.daily.time.map((d: string, i: number) => ({
      date: d,
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
      code: j.daily.weather_code[i],
      rain: j.daily.precipitation_probability_max?.[i],
      sunrise: j.daily.sunrise?.[i],
      sunset: j.daily.sunset?.[i],
      uv: j.daily.uv_index_max?.[i],
      precip: j.daily.precipitation_sum?.[i],
    })),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(w));
  } catch {}
  return w;
}

export function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code <= 48) return { label: "Fog", icon: "🌫️" };
  if (code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code <= 77) return { label: "Snow", icon: "🌨️" };
  if (code <= 82) return { label: "Showers", icon: "🌧️" };
  if (code <= 86) return { label: "Snow showers", icon: "🌨️" };
  return { label: "Thunderstorm", icon: "⛈️" };
}

/** Key of the sky-gradient class used for the page background. */
export function skyKey(code: number, isDay: number | undefined): string {
  const day = isDay !== 0;
  if (code <= 2) return day ? "clear-day" : "clear-night";
  if (code === 3) return day ? "cloudy-day" : "cloudy-night";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  return "storm";
}
