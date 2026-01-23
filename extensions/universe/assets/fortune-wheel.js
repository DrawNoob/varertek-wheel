// extensions/universe/assets/fortune-wheel.js
(function () {
  if (!window.__VT_WHEEL_EMBED_ENABLED__) {
    return;
  }
  const PROXY_URL = "/apps/vadertek-timer";
  const DEFAULT_COLORS = [
    "#f87171",
    "#fbbf24",
    "#34d399",
    "#60a5fa",
    "#a78bfa",
    "#f472b6",
  ];

  // -----------------------------
  //
  // -----------------------------
  async function loadWheelConfig() {
    try {
      const res = await fetch(PROXY_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        console.error("Wheel config load failed with status", res.status);
        return null;
      }

      const data = await res.json();
      const segments = Array.isArray(data.wheelSegments) ? data.wheelSegments : null;
      if (!segments || segments.length === 0) return null;
      return segments;
    } catch (e) {
      console.error("Wheel config load error", e);
      return null;
    }
  }

  function buildGradient(disc, count) {
    const style = getComputedStyle(disc);
    const colors = [];
    for (let i = 1; i <= 6; i++) {
      const value = style.getPropertyValue(`--seg${i}`).trim();
      if (value) colors.push(value);
    }
    const palette = colors.length ? colors : DEFAULT_COLORS;
    const angle = 360 / count;
    const stops = [];

    for (let i = 0; i < count; i++) {
      const start = i * angle;
      const end = (i + 1) * angle;
      const color = palette[i % palette.length];
      stops.push(`${color} ${start}deg ${end}deg`);
    }

    disc.style.background = `conic-gradient(${stops.join(", ")})`;
  }

  function renderLabels(overlay, segments) {
    const disc = overlay.querySelector(".vt-wheel-disc");
    const labelsRoot = overlay.querySelector(".vt-wheel-labels");
    if (!disc || !labelsRoot) return;

    labelsRoot.innerHTML = "";
    const count = segments.length;
    const angle = 360 / count;
    const rect = disc.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const labelRadius = Math.max(60, radius - 52);

    segments.forEach((seg, idx) => {
      const label = document.createElement("span");
      label.className = "vt-wheel-label";
      label.textContent = seg && seg.label ? seg.label : "";
      const angleDeg = idx * angle + angle / 2;
      label.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg) translate(0, -${labelRadius}px) rotate(-${angleDeg}deg)`;
      labelsRoot.appendChild(label);
    });

    buildGradient(disc, count);
  }

  // -----------------------------
  //
  // -----------------------------
  function initWheelOverlays(segments) {
    const overlays = document.querySelectorAll("[data-vt-wheel-overlay]");
    if (!overlays.length) return;
  
    overlays.forEach(function (overlay) {
      const uid = overlay.getAttribute("data-uid");
      const closeBtn = overlay.querySelector(".vt-wheel-close");
      const spinBtn = overlay.querySelector(".vt-wheel-spin-btn");
      const disc = overlay.querySelector(".vt-wheel-disc");
      const trigger = document.querySelector(".vt-wheel-trigger-" + uid);
      const emailInput = overlay.querySelector(".vt-wheel-email-input");
      const emailWrapper = overlay.querySelector(".vt-wheel-email-wrapper");
  
      //
      const codeWrapper = overlay.querySelector(".vt-wheel-code-wrapper");
      const codeInput = overlay.querySelector(".vt-wheel-code-input");
      const copyBtn = overlay.querySelector(".vt-wheel-copy-btn");
      const codeCopiedEl = overlay.querySelector(".vt-wheel-code-copied");
  
      const errorEl = overlay.querySelector("[data-vt-wheel-error]");
      const successEl = overlay.querySelector("[data-vt-wheel-success]");
      const centerEl = overlay.querySelector(".vt-wheel-center");
      const attrEmail = overlay.getAttribute("data-email") || "";
      const errorMessage =
        overlay.getAttribute("data-error-message") ||
        "Введ\u0456ть коректний email, щоб крутити колесо.";
      const usedMessage = "Цей email вже використовував колесо.";
      const defaultSuccess =
        overlay.getAttribute("data-success-message") ||
        "Ви усп\u0456шно прокрутили колесо!";
  

      if (Array.isArray(segments) && segments.length > 0) {
        renderLabels(overlay, segments);
      }

      function showError(msg) {
        if (errorEl) errorEl.textContent = msg || "";
      }

      function showSuccess(msg) {
        if (successEl) successEl.textContent = msg || "";
      }

      function getEmail() {
        const inputValue = emailInput ? emailInput.value.trim() : "";
        return inputValue || attrEmail;
      }

      function isValidEmail(value) {
        if (!value) return false;
        return /\S+@\S+\.\S+/.test(value);
      }

      function rememberEmail(value) {
        if (!value) return;
        if (window.vtAnalytics && typeof window.vtAnalytics.setEmail === "function") {
          window.vtAnalytics.setEmail(value);
          return;
        }
        try {
          window.localStorage.setItem("vt_email", value);
        } catch {
          // ignore
        }
      }

      //
      function openOverlay() {
        overlay.classList.remove("vt-wheel-overlay--hidden");
        if (trigger) {
          trigger.classList.add("vt-wheel-trigger--hidden");
        }
      }

      function closeOverlay() {
        overlay.classList.add("vt-wheel-overlay--hidden");
        if (trigger) {
          trigger.classList.remove("vt-wheel-trigger--hidden");
        }
      }

      setTimeout(openOverlay, 3000);

      if (closeBtn) {
        closeBtn.addEventListener("click", closeOverlay);
      }

      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          closeOverlay();
        }
      });

      if (trigger) {
        trigger.addEventListener("click", openOverlay);
      }

      // -----------------------------
      //
      // -----------------------------
      let currentRotation = 0;

      async function spinWheel() {
        if (!disc || !spinBtn) return;
        if (!Array.isArray(segments) || segments.length === 0) {
          showError("Колесо не налаштоване.");
          return;
        }

        const email = getEmail();

        //
        if (!isValidEmail(email)) {
          showSuccess("");
          showError(errorMessage);
          return;
        }
        rememberEmail(email);

        const deviceType = window.innerWidth < 768 ? "Mobile" : "Desktop";

        //
        spinBtn.disabled = true;
        showError("");
        showSuccess("");

        try {
          const res = await fetch(PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: "wheelSpin",
              email,
              device_type: deviceType,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.ok) {
            const msg =
              data?.message === "Цей email вже використовував колесо."
                ? usedMessage
                : data?.message || "Сталася помилка, спробуйте ще раз."
            showError(msg);
            spinBtn.disabled = false;
            return;
          }

          const { index, label, code } = data.result;
          const segmentAngle = 360 / segments.length;

          //
          showError("");
          showSuccess(`${defaultSuccess} Ваш виграш: ${label}. Код д\u0456йсний 3 доби.`);
          if (centerEl) {
            centerEl.textContent = "\uD83C\uDF81";
          }

          //
          if (emailWrapper) {
            emailWrapper.style.display = "none";
          }
          if (codeWrapper) {
            codeWrapper.classList.remove("vt-wheel-code-wrapper--hidden");
          }
          if (codeInput) {
            codeInput.value = code;
          }
          if (codeCopiedEl) {
            codeCopiedEl.textContent = "";
          }


          //
          //
          const baseOffset = -segmentAngle / 2; 
          const extraTurns = 3 + Math.floor(Math.random() * 3);
          const targetAngle =
            extraTurns * 360 + index * segmentAngle + baseOffset;

          currentRotation += targetAngle;

          //
          disc.style.animation = "none";

          //
          disc.style.transition =
            "transform 4s cubic-bezier(0.23, 1, 0.32, 1)";
          disc.style.transform = `rotate(${currentRotation}deg)`;

          //
          setTimeout(function () {
            spinBtn.disabled = false;
          }, 4200);
        } catch (err) {
          console.error("WheelSpin error", err);
          showError("Сталася помилка, спробуйте ще раз.");
          spinBtn.disabled = false;
        }
      }

      //
      if (copyBtn && codeInput) {
        copyBtn.addEventListener("click", async function () {
          if (!codeInput.value) return;

          try {
            await navigator.clipboard.writeText(codeInput.value);
            if (codeCopiedEl) {
              codeCopiedEl.textContent = "Скопійовано ✓";
            }
          } catch (e) {
            console.error("Clipboard error", e);
            if (codeCopiedEl) {
              codeCopiedEl.textContent = "Не вдалося скопіювати :(";
            }
          }
        });
      }

      if (spinBtn) {
        spinBtn.addEventListener("click", spinWheel);
      }
    });
  }

  // -----------------------------
  //
  // -----------------------------
  async function bootstrap() {
    const segments = await loadWheelConfig();
    initWheelOverlays(segments);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
















