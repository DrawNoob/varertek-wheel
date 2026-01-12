// Basic storefront analytics via app proxy
(function () {
  const PROXY_URL = "/apps/vadertek-timer";
  const EMAIL_KEY = "vt_email";

  function getStoredEmail() {
    try {
      return window.localStorage.getItem(EMAIL_KEY) || "";
    } catch {
      return "";
    }
  }

  function setStoredEmail(value) {
    if (!value) return;
    try {
      window.localStorage.setItem(EMAIL_KEY, value);
    } catch {
      // ignore
    }
  }

  function parseProductHandle(href) {
    if (!href) return null;
    try {
      const url = new URL(href, window.location.origin);
      const match = url.pathname.match(/\/products\/([^\/\?#]+)/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function sendEvent(eventType, details) {
    const knownEmail = getStoredEmail();
    const payload = {
      intent: "trackEvent",
      eventType,
      url: window.location.href,
      email: knownEmail || "non-logged-in",
      device_type: window.innerWidth < 768 ? "Mobile" : "Desktop",
      ...details,
    };

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(PROXY_URL, blob);
      return;
    }

    fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function trackPageView() {
    sendEvent("page_view", { eventData: { referrer: document.referrer || null } });
  }

  function trackProductClicks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link || !link.href) return;
      const handle = parseProductHandle(link.href);
      if (!handle) return;
      sendEvent("product_click", { productHandle: handle });
    });
  }

  function trackAddToCart() {
    let lastAddAt = 0;

    function fireAdd() {
      const now = Date.now();
      if (now - lastAddAt < 800) return;
      lastAddAt = now;
      const handle = parseProductHandle(window.location.href);
      sendEvent("add_to_cart", { productHandle: handle });
    }

    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || !form.action) return;
      if (!form.action.includes("/cart/add")) return;
      fireAdd();
    });

    document.addEventListener("click", (event) => {
      const btn = event.target.closest('button[name="add"], button[type="submit"]');
      if (!btn) return;
      const form = btn.closest("form");
      if (!form || !form.action || !form.action.includes("/cart/add")) return;
      fireAdd();
    });
  }

  window.vtAnalytics = {
    setEmail: setStoredEmail,
  };

  document.addEventListener("DOMContentLoaded", () => {
    trackPageView();
    trackProductClicks();
    trackAddToCart();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) trackPageView();
  });
})();
