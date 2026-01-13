// Basic storefront analytics via app proxy
(function () {
  const PROXY_URL = "/apps/vadertek-timer";
  const EMAIL_KEY = "vt_email";
  const CART_CACHE_TTL = 15000;
  let cachedPurchaseTypes = null;
  let lastCartFetchAt = 0;

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

  function getPurchaseTypesFromItems(items) {
    const safeItems = Array.isArray(items) ? items : [];
    const typeSet = new Set();

    safeItems.forEach((item) => {
      const type = String(item.product_type || "").trim().toLowerCase();
      if (type) typeSet.add(type);
    });

    return Array.from(typeSet);
  }

  async function fetchCartSummary() {
    const now = Date.now();
    if (now - lastCartFetchAt < CART_CACHE_TTL && cachedPurchaseTypes !== null) {
      return cachedPurchaseTypes;
    }
    lastCartFetchAt = now;

    try {
      const res = await fetch("/cart.js", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        keepalive: true,
      });
      if (!res.ok) return;
      const data = await res.json();
      const types = getPurchaseTypesFromItems(data.items);
      cachedPurchaseTypes = types;
      return types;
    } catch {
      // ignore
    }
    return null;
  }

  async function trackCheckoutIntent() {
    const types = await fetchCartSummary();
    if (types && types.length > 0) {
      sendEvent("product_type_purchase", { eventData: { types } });
    }
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
      fetchCartSummary();
    }

    function isAddToCart(button) {
      if (!button) return false;
      if (button.name === "add") return true;
      const form = button.closest("form");
      if (form && form.action && form.action.includes("/cart/add")) return true;
      return false;
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
      if (!isAddToCart(btn)) return;
      fireAdd();
    });
  }

  function isCheckoutTrigger(element) {
    if (!element) return false;
    if (element.closest('a[href*="/checkout"]')) return true;
    const button = element.closest("button, input[type=\"submit\"]");
    if (button) {
      const name = (button.name || "").toLowerCase();
      const value = (button.value || "").toLowerCase();
      if (name.includes("checkout") || value.includes("checkout")) return true;
      const aria = (button.getAttribute("aria-label") || "").toLowerCase();
      if (aria.includes("checkout")) return true;
      const form = button.closest("form");
      if (form && form.action && form.action.includes("/checkout")) return true;
      if (form && form.action && form.action.includes("/cart") && name === "checkout") {
        return true;
      }
    }
    return false;
  }

  function trackButtonClicks() {
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(
        'button, input[type="button"], input[type="submit"], [role="button"]',
      );
      if (!btn) return;
      if (btn.closest("form") && btn.closest("form").action?.includes("/cart/add")) {
        return;
      }
      if (btn.name === "add") return;
      if (isCheckoutTrigger(btn)) return;

      const label =
        (btn.textContent || btn.value || "").trim() || "button";
      sendEvent("button_click", { eventData: { label } });
    });
  }

  function trackCheckoutClicks() {
    let lastCheckoutAt = 0;

    function fireCheckout() {
      const now = Date.now();
      if (now - lastCheckoutAt < 1500) return;
      lastCheckoutAt = now;
      if (cachedPurchaseTypes && cachedPurchaseTypes.length > 0) {
        sendEvent("product_type_purchase", {
          eventData: { types: cachedPurchaseTypes },
        });
        fetchCartSummary();
      } else {
        trackCheckoutIntent();
      }
    }

    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href*="/checkout"]');
      if (link) {
        fireCheckout();
        return;
      }

      if (isCheckoutTrigger(event.target)) {
        fireCheckout();
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || !form.action) return;
      if (form.action.includes("/checkout")) {
        fireCheckout();
        return;
      }
      if (form.action.includes("/cart")) {
        const submitter = event.submitter;
        const name = (submitter?.name || "").toLowerCase();
        const value = (submitter?.value || "").toLowerCase();
        if (name.includes("checkout") || value.includes("checkout")) {
          fireCheckout();
        }
      }
    });
  }

  window.vtAnalytics = {
    setEmail: setStoredEmail,
  };

  document.addEventListener("DOMContentLoaded", () => {
    trackPageView();
    trackProductClicks();
    trackAddToCart();
    trackButtonClicks();
    trackCheckoutClicks();
    fetchCartSummary();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) trackPageView();
  });
})();
