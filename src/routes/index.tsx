import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { describe, fetchWeather, loadCached, searchCity, skyKey, type Place, type Weather } from "@/lib/weather";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Weather Pal" },
      { name: "description", content: "Current temperature, hourly and 7-day forecast. No tracking, works offline." },
      { property: "og:title", content: "My Weather Pal" },
      { property: "og:description", content: "Current temperature, hourly and 7-day forecast. No tracking, works offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SKY_PREF_KEY = "weather:sky-pref";
const SAVED_KEY = "weather:saved-places";
const UNITS_KEY = "weather:units";
type Units = "metric" | "imperial";

function tempU(c: number, u: Units) {
  return Math.round(u === "imperial" ? (c * 9) / 5 + 32 : c);
}
function windU(k: number, u: Units) {
  return u === "imperial" ? `${Math.round(k / 1.609)} mph` : `${Math.round(k)} km/h`;
}
function precipU(mm: number, u: Units) {
  return u === "imperial" ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`;
}
function uvLabel(uv: number) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}
function ago(ts: number, now: number) {
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function loadSaved(): Place[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function samePlace(a: Place, b: Place) {
  return a.lat === b.lat && a.lon === b.lon;
}
const SKY_OPTIONS = [
  { value: "auto", label: "Auto (weather)" },
  { value: "clear-day", label: "Sunny day" },
  { value: "clear-night", label: "Clear night" },
  { value: "cloudy-day", label: "Cloudy day" },
  { value: "cloudy-night", label: "Cloudy night" },
  { value: "fog", label: "Fog" },
  { value: "rain", label: "Rain" },
  { value: "snow", label: "Snow" },
  { value: "storm", label: "Storm" },
];

function Index() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [showLocDialog, setShowLocDialog] = useState(false);
  const [skyChoice, setSkyChoice] = useState("auto");
  const [saved, setSaved] = useState<Place[]>([]);
  const [units, setUnits] = useState<Units>("metric");

  function toggleUnits() {
    const next: Units = units === "metric" ? "imperial" : "metric";
    setUnits(next);
    try {
      localStorage.setItem(UNITS_KEY, next);
    } catch {}
  }

  function persistSaved(next: Place[]) {
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {}
  }

  function toggleSave(place: Place) {
    persistSaved(
      saved.some((s) => samePlace(s, place))
        ? saved.filter((s) => !samePlace(s, place))
        : [...saved, place],
    );
  }

  function removeSaved(place: Place) {
    persistSaved(saved.filter((s) => !samePlace(s, place)));
  }

  function moveSaved(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= saved.length) return;
    const next = [...saved];
    const item = next[index]!;
    next[index] = next[to]!;
    next[to] = item;
    persistSaved(next);
  }

  async function load(place: Place) {
    setLoading(true);
    setError(null);
    try {
      setWeather(await fetchWeather(place));
      setOffline(false);
    } catch {
      setOffline(true);
      setError("Couldn't reach the weather service. Showing last saved weather if available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SKY_PREF_KEY);
      if (saved && SKY_OPTIONS.some((o) => o.value === saved)) setSkyChoice(saved);
    } catch {}
    setSaved(loadSaved());
    try {
      if (localStorage.getItem(UNITS_KEY) === "imperial") setUnits("imperial");
    } catch {}
  }, []);

  useEffect(() => {
    const cached = loadCached();
    if (cached) {
      setWeather(cached);
      if (navigator.onLine) load(cached.place);
      else setOffline(true);
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await searchCity(q.trim());
      setResults(r);
      if (!r.length) setError("No matching city found.");
      else setError(null);
    } catch {
      setError("Search needs an internet connection.");
    }
  }

  function useLocation() {
    setShowLocDialog(false);
    if (!navigator.geolocation) return setError("Location isn't supported in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => load({ name: "My location", lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
      () => setError("Location permission was denied. You can search for a city instead."),
      { timeout: 10000 },
    );
  }

  function onSkyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setSkyChoice(v);
    try {
      if (v === "auto") localStorage.removeItem(SKY_PREF_KEY);
      else localStorage.setItem(SKY_PREF_KEY, v);
    } catch {}
  }

  const autoSky = weather ? skyKey(weather.current.code, weather.current.is_day) : "default";
  const sky = skyChoice === "auto" ? autoSky : skyChoice;

  return (
    <div className={`sky sky-${sky} min-h-screen text-foreground`}>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">My Weather Pal</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleUnits}
              aria-label={`Switch to ${units === "metric" ? "Fahrenheit" : "Celsius"}`}
              title="Switch units"
              className="rounded-lg border border-input bg-card px-2 py-1 text-sm font-medium text-card-foreground hover:bg-accent"
            >
              {units === "metric" ? "°C" : "°F"}
            </button>
            <select
              value={skyChoice}
              onChange={onSkyChange}
              aria-label="Background color"
              title="Background color"
              className="rounded-lg border border-input bg-card px-2 py-1 text-sm text-card-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {SKY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Link to="/privacy" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Privacy
            </Link>
          </div>
        </header>

        <form onSubmit={onSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a city…"
            aria-label="Search a city"
            className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-card-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Search</button>
          <button
            type="button"
            onClick={() => setShowLocDialog(true)}
            className="rounded-lg border border-input px-3 py-2"
            aria-label="Use my location"
            title="Use my location"
          >
            📍
          </button>
        </form>

        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Saved locations">
            {saved.map((p, i) => (
              <span
                key={`${p.lat},${p.lon}`}
                className="inline-flex items-center overflow-hidden rounded-full border border-input bg-card text-sm text-card-foreground"
              >
                <button
                  onClick={() => load(p)}
                  className="px-3 py-1.5 hover:bg-accent"
                  title={`Show weather for ${p.name}`}
                >
                  {p.name}
                </button>
                <button
                  onClick={() => moveSaved(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${p.name} earlier`}
                  title="Move left"
                  className="px-1.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  ‹
                </button>
                <button
                  onClick={() => moveSaved(i, 1)}
                  disabled={i === saved.length - 1}
                  aria-label={`Move ${p.name} later`}
                  title="Move right"
                  className="px-1.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                >
                  ›
                </button>
                <button
                  onClick={() => removeSaved(p)}
                  aria-label={`Remove ${p.name} from saved locations`}
                  title="Remove"
                  className="px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`} className="flex items-center">
                <button
                  className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-accent"
                  onClick={() => {
                    setResults([]);
                    setQ("");
                    load(r);
                  }}
                >
                  {r.name} <span className="text-muted-foreground">{r.country}</span>
                </button>
                <button
                  onClick={() => toggleSave(r)}
                  aria-label={
                    saved.some((s) => samePlace(s, r))
                      ? `Remove ${r.name} from saved locations`
                      : `Save ${r.name}`
                  }
                  title={saved.some((s) => samePlace(s, r)) ? "Saved — tap to remove" : "Save this location"}
                  className="px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {saved.some((s) => samePlace(s, r)) ? "★" : "☆"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {offline && weather && (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-card-foreground">
            Offline — showing weather saved {new Date(weather.fetchedAt).toLocaleString()}.
          </p>
        )}
        {error && !offline && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {loading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

        {!weather && !loading && (
          <p className="mt-12 text-center text-muted-foreground">Search for a city or use your location to begin.</p>
        )}

        {weather && (
          <>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => toggleSave(weather.place)}
                className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-card-foreground hover:bg-accent"
              >
                {saved.some((s) => samePlace(s, weather.place)) ? "★ Saved — tap to remove" : "☆ Save this location"}
              </button>
            </div>
            <WeatherView w={weather} units={units} loading={loading} onRefresh={() => load(weather.place)} />
          </>
        )}
      </main>

      {showLocDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4" role="dialog" aria-modal="true">
          <div className="max-w-sm rounded-xl bg-card p-6 text-card-foreground shadow-lg">
            <h2 className="text-lg font-semibold">Use your location?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your browser will ask for permission. Your coordinates are rounded and sent only to Open-Meteo to get the
              local forecast. Nothing is stored on any server or shared with anyone else.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowLocDialog(false)} className="rounded-lg border border-input text-card-foreground px-4 py-2">
                Not now
              </button>
              <button onClick={useLocation} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeatherView({
  w,
  units,
  loading,
  onRefresh,
}: {
  w: Weather;
  units: Units;
  loading: boolean;
  onRefresh: () => void;
}) {
  const d = describe(w.current.code);
  const today = w.daily[0];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [w.fetchedAt]);
  const time = (iso?: string) => (iso ? iso.slice(11, 16) : "—");
  let daylight = "";
  if (today?.sunrise && today?.sunset) {
    const mins = (new Date(today.sunset).getTime() - new Date(today.sunrise).getTime()) / 60000;
    daylight = `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m of daylight`;
  }
  const stats: { label: string; value: string }[] = [];
  if (w.current.humidity != null) stats.push({ label: "Humidity", value: `${Math.round(w.current.humidity)}%` });
  if (today?.uv != null) stats.push({ label: "UV index", value: `${Math.round(today.uv)} · ${uvLabel(today.uv)}` });
  if (today?.precip != null) stats.push({ label: "Precip. today", value: precipU(today.precip, units) });

  return (
    <>
      <section className="mt-6 rounded-2xl bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {w.place.name}
            {w.place.country ? `, ${w.place.country}` : ""}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Updated {ago(w.fetchedAt, now)}</span>
            <button
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh weather"
              title="Refresh"
              className={`rounded-full px-1.5 text-base hover:bg-accent hover:text-foreground disabled:opacity-50 ${loading ? "animate-spin" : ""}`}
            >
              ↻
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-6xl">{d.icon}</span>
          <div>
            <p className="text-6xl font-bold">{tempU(w.current.temp, units)}°</p>
            <p className="text-muted-foreground">
              {d.label} · Feels {tempU(w.current.feels, units)}° · Wind {windU(w.current.wind, units)}
            </p>
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {today?.sunrise && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <span>🌅 {time(today.sunrise)}</span>
            <span className="text-xs text-muted-foreground">{daylight}</span>
            <span>🌇 {time(today.sunset)}</span>
          </div>
        )}
      </section>

      {w.periods && w.periods.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Day &amp; night</h2>
          <div className="grid grid-cols-2 gap-2">
            {w.periods.map((p) => {
              const pd = describe(p.code);
              return (
                <div key={p.label} className="rounded-lg bg-card p-4 text-card-foreground">
                  <p className="text-xs text-muted-foreground">
                    {p.label === "Day" ? "☀️ Day (6am–6pm)" : "🌙 Tonight (6pm–6am)"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-3xl">{pd.icon}</span>
                    <div>
                      <p className="font-medium">{pd.label}</p>
                      <p className="text-sm">
                        <span className="font-medium">{tempU(p.high, units)}°</span>{" "}
                        <span className="text-muted-foreground">{tempU(p.low, units)}°</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    💧 {Math.round(p.rain)}% · Wind up to {windU(p.wind, units)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Today</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {w.hourly.map((h) => (
            <div key={h.time} className="min-w-16 rounded-lg bg-card px-2 py-3 text-center text-card-foreground">
              <p className="text-xs text-muted-foreground">{h.time.slice(11, 16)}</p>
              <p className="text-xl">{describe(h.code).icon}</p>
              <p className="font-medium">{tempU(h.temp, units)}°</p>
              {h.rain != null && h.rain >= 20 && <p className="text-xs text-primary">💧{h.rain}%</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">7 days</h2>
        <ul className="divide-y divide-border rounded-lg bg-card text-card-foreground">
          {w.daily.map((day, i) => (
            <li key={day.date} className="flex items-center justify-between px-4 py-3">
              <span className="w-24">
                {i === 0 ? "Today" : new Date(day.date + "T12:00").toLocaleDateString(undefined, { weekday: "long" })}
              </span>
              <span className="flex w-20 items-center gap-1">
                <span className="text-xl" title={describe(day.code).label}>{describe(day.code).icon}</span>
                {day.rain != null && day.rain >= 20 && <span className="text-xs text-primary">💧{day.rain}%</span>}
              </span>
              <span className="w-24 text-right">
                <span className="font-medium">{tempU(day.max, units)}°</span>{" "}
                <span className="text-muted-foreground">{tempU(day.min, units)}°</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Data by <a className="underline" href="https://open-meteo.com/">Open-Meteo</a>
      </p>
    </>
  );
}
