// Single place that registers the offline service worker. Refuses in dev/preview/iframes.
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const h = location.hostname;
  const refuse =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(h) ||
    /(^|\.)beta\.lovable\.dev$/.test(h) ||
    new URLSearchParams(location.search).get("sw") === "off";
  if (refuse) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
    );
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
