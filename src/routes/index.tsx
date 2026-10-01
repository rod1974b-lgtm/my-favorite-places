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
            <WeatherView w={weather} />
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

function WeatherView({ w }: { w: Weather }) {
  const d = describe(w.current.code);
  return (
    <>
      <section className="mt-6 rounded-2xl bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          {w.place.name}
          {w.place.country ? `, ${w.place.country}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-6xl">{d.icon}</span>
          <div>
            <p className="text-6xl font-bold">{Math.round(w.current.temp)}°</p>
            <p className="text-muted-foreground">
              {d.label} · Feels {Math.round(w.current.feels)}° · Wind {Math.round(w.current.wind)} km/h
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Today</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {w.hourly.map((h) => (
            <div key={h.time} className="min-w-16 rounded-lg bg-card px-2 py-3 text-center text-card-foreground">
              <p className="text-xs text-muted-foreground">{h.time.slice(11, 16)}</p>
              <p className="text-xl">{describe(h.code).icon}</p>
              <p className="font-medium">{Math.round(h.temp)}°</p>
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
              <span className="text-xl" title={describe(day.code).label}>{describe(day.code).icon}</span>
              <span className="w-24 text-right">
                <span className="font-medium">{Math.round(day.max)}°</span>{" "}
                <span className="text-muted-foreground">{Math.round(day.min)}°</span>
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
