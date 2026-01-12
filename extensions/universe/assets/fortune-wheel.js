// extensions/universe/assets/fortune-wheel.js
(function () {
  const PROXY_URL = "/apps/vadertek-timer";
  const SEGMENTS_COUNT = 6;
  const SEGMENT_ANGLE = 360 / SEGMENTS_COUNT;

  // -----------------------------
  // 1) Тягнемо конфіг колеса
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
      return Array.isArray(data.wheelSegments) ? data.wheelSegments : null;
    } catch (e) {
      console.error("Wheel config load error", e);
      return null;
    }
  }

  // -----------------------------
  // 2) Ініціалізація попапів
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
  
      // НОВІ елементи для коду
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
        "Введіть коректний email, щоб крутити колесо.";
      const usedMessage = "Цей email вже використовував колесо.";
      const defaultSuccess =
        overlay.getAttribute("data-success-message") ||
        "Ви успішно прокрутили колесо!";
  

      // Підставити лейбли секторів
      if (segments && segments.length === SEGMENTS_COUNT) {
        const labelEls = overlay.querySelectorAll(".vt-wheel-label");
        labelEls.forEach(function (el) {
          const index = Number(el.getAttribute("data-segment-index") || 0);
          const seg = segments[index];
          el.textContent = seg && seg.label ? seg.label : "";
        });
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

      // Відкриття/закриття попапа
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
      // 3) Логіка "Крутити колесо"
      // -----------------------------
      let currentRotation = 0;

      async function spinWheel() {
        if (!disc || !spinBtn) return;

        const email = getEmail();

        // 1) Валідація email
        if (!isValidEmail(email)) {
          showSuccess("");
          showError(errorMessage);
          return;
        }
        rememberEmail(email);

        const deviceType = window.innerWidth < 768 ? "Mobile" : "Desktop";

        // 2) Запит на бекенд → random сегмент по шансах
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
                : data?.message || "Сталася помилка, спробуйте ще раз.";
            showError(msg);
            spinBtn.disabled = false;
            return;
          }

          const { index, label, code } = data.result;

          // 3) Текст успіху (БЕЗ показу коду)
          showError("");
          showSuccess(`${defaultSuccess} Ваш виграш: ${label}. Код дійсний 3 доби.`);
          if (centerEl) {
            centerEl.textContent = "✓";
          }

          // 3.1 Показуємо блок з кодом замість поля email
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


          // 4) Обертання до потрібного сектору
          //    0-й сектор — зверху; якщо треба змістити, змінюй baseOffset.
          const baseOffset = -SEGMENT_ANGLE / 2; // щоб pointer бив приблизно в центр сектору
          const extraTurns = 3 + Math.floor(Math.random() * 3); // 3–5 повних обертів
          const targetAngle =
            extraTurns * 360 + index * SEGMENT_ANGLE + baseOffset;

          currentRotation += targetAngle;

          // відключаємо стару CSS-анімацію, якщо є
          disc.style.animation = "none";

          // плавний transition
          disc.style.transition =
            "transform 4s cubic-bezier(0.23, 1, 0.32, 1)";
          disc.style.transform = `rotate(${currentRotation}deg)`;

          // розблокувати кнопку після завершення анімації
          setTimeout(function () {
            spinBtn.disabled = false;
          }, 4200);
        } catch (err) {
          console.error("WheelSpin error", err);
          showError("Сталася помилка, спробуйте ще раз.");
          spinBtn.disabled = false;
        }
      }

      // Кнопка "Скопіювати"
      if (copyBtn && codeInput) {
        copyBtn.addEventListener("click", async function () {
          if (!codeInput.value) return;

          try {
            await navigator.clipboard.writeText(codeInput.value);
            if (codeCopiedEl) {
              codeCopiedEl.textContent = "Скопійовано ✅";
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
  // 4) Старт
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
