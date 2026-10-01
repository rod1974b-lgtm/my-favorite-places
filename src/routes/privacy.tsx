import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — My Weather Pal" },
      { name: "description", content: "How My Weather Pal handles your data: no accounts, no trackers, no analytics." },
      { property: "og:title", content: "Privacy — My Weather Pal" },
      { property: "og:description", content: "How My Weather Pal handles your data: no accounts, no trackers, no analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Back to weather</Link>
      <h1 className="mt-4 text-3xl font-bold">Privacy</h1>
      <div className="mt-6 space-y-4 leading-relaxed">
        <p>My Weather Pal has no accounts, no analytics, no ads and no trackers. There are no cookies.</p>
        <h2 className="text-xl font-semibold">What is sent</h2>
        <p>
          City searches and coordinates are sent directly from your browser to{" "}
          <a className="underline" href="https://open-meteo.com/en/terms">Open-Meteo</a> to look up places and forecasts.
          Location coordinates are rounded to about 100 m first. Nothing is sent to us.
        </p>
        <h2 className="text-xl font-semibold">Your location</h2>
        <p>Location is only requested after you tap the location button and confirm. You can decline and search instead.</p>
        <h2 className="text-xl font-semibold">What is stored on your device</h2>
        <p>
          The last forecast you viewed is saved in your browser so the app works offline. Clearing your browser's site
          data removes it.
        </p>
      </div>
    </main>
  );
}
