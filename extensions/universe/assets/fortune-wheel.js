// extensions/universe/assets/fortune-wheel.js
(function () {
  if (!window.__VT_WHEEL_EMBED_ENABLED__) {
    return;
  }
  const PROXY_URL = "/apps/vadertek-timer";
  const SEGMENT_COLOR = "#1A365D";

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
    const palette = [SEGMENT_COLOR];
    const angle = 360 / count;
    const stops = [];

    for (let i = 0; i < count; i++) {
      const start = i * angle;
      const mid = start + angle / 2;
      const end = start + angle;
      const color = palette[i % palette.length];
      stops.push(`${color} ${start}deg ${mid}deg`);
      stops.push(`#ffffff ${mid}deg ${end}deg`);
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
      const angleDeg = idx * angle + angle / 4;
      label.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg) translate(0, -${labelRadius}px)`;
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
      const useCodeBtn = overlay.querySelector(".vt-wheel-use-code-btn");
      const disc = overlay.querySelector(".vt-wheel-disc");
      const trigger = document.querySelector(".vt-wheel-trigger-" + uid);
      const openButtons = document.querySelectorAll(".open-wheel");
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
      const closeLink = overlay.getAttribute("data-close-link") || "";
      const attrEmail = overlay.getAttribute("data-email") || "";
      const errorMessage =
        overlay.getAttribute("data-error-message") ||
        "Введ\u0456ть коректний email, щоб крутити колесо.";
      const usedMessage = "Цей email ви вже використали. Ось ваш код:";
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

      function setUseCodeButtonState(enabled) {
        if (!useCodeBtn) return;
        useCodeBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
        useCodeBtn.classList.toggle("vt-wheel-use-code-btn--disabled", !enabled);
      }

      function showUseCodeButton(enabled) {
        if (spinBtn) {
          spinBtn.style.display = "none";
        }
        if (useCodeBtn) {
          useCodeBtn.classList.remove("vt-wheel-use-code-btn--hidden");
          setUseCodeButtonState(Boolean(enabled));
        }
      }

      function getEmail() {
        const inputValue = emailInput ? emailInput.value.trim() : "";
        return inputValue || attrEmail;
      }

      function isValidEmail(value) {
        if (!value) return false;
        const email = value.trim();
        const emailRegex =
          /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i;
        return emailRegex.test(email);
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
      let hasSpun = false;
      let hasCopied = false;

      function openOverlay() {
        overlay.classList.remove("vt-wheel-overlay--hidden");
        if (trigger) {
          trigger.classList.add("vt-wheel-trigger--hidden");
        }
      }

      function closeOverlay() {
        if (hasSpun && !hasCopied) {
          showError("Скопіюй, щоб не втратити код.");
          return false;
        }
        if (closeLink) {
          window.location.href = closeLink;
          return true;
        }
        overlay.classList.add("vt-wheel-overlay--hidden");
        if (trigger) {
          trigger.classList.remove("vt-wheel-trigger--hidden");
        }
        return true;
      }

      if (closeBtn) {
        closeBtn.addEventListener("click", closeOverlay);
      }

      if (useCodeBtn) {
        useCodeBtn.addEventListener("click", function () {
          if (useCodeBtn.classList.contains("vt-wheel-use-code-btn--disabled")) {
            showSuccess("");
            showError("Скопіюй, щоб не втратити код.");
            return;
          }
          closeOverlay();
        });
      }

      // Close only via the close button.

      if (trigger) {
        trigger.addEventListener("click", openOverlay);
      }
      if (openButtons.length) {
        openButtons.forEach(function (btn) {
          btn.addEventListener("click", function (event) {
            if (event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
            openOverlay();
          });
        });
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
            if (data?.existingCode) {
              const existingLabel = data?.existingLabel ? ` Ваш виграш: ${data.existingLabel}.` : "";
              showError("");
              showSuccess(`${usedMessage} ${data.existingCode}.${existingLabel}`);
              hasSpun = true;

              if (emailWrapper) {
                emailWrapper.style.display = "none";
              }
              if (codeWrapper) {
                codeWrapper.classList.remove("vt-wheel-code-wrapper--hidden");
              }
              if (codeInput) {
                codeInput.value = data.existingCode;
              }
              if (codeCopiedEl) {
                codeCopiedEl.textContent = "";
              }

              showUseCodeButton(false);
              spinBtn.disabled = false;
              return;
            }

            const msg =
              data?.message === "Цей email вже використовував колесо."
                ? usedMessage
                : data?.message || "Сталася помилка, спробуйте ще раз.";
            showError(msg);
            spinBtn.disabled = false;
            return;
          }

          const { index, label, code } = data.result;
          const segmentAngle = 360 / segments.length;

          const successMessage = `${defaultSuccess} Ваш виграш: ${label}. Код дійсний 1 місяць.`;

          //
          showError("");
          // Показуємо success-повідомлення лише після завершення анімації обертання.
          showSuccess("");
          if (centerEl) {
            // keep existing center content (image/logo)
          }
          hasSpun = true;

          //
          if (emailWrapper) {
            emailWrapper.style.display = "none";
          }
          if (codeWrapper) {
            codeWrapper.classList.add("vt-wheel-code-wrapper--hidden");
          }
          if (codeInput) {
            codeInput.value = "";
          }
          if (codeCopiedEl) {
            codeCopiedEl.textContent = "";
          }

          showUseCodeButton(false);

          //
          //
          const extraTurns = 3 + Math.floor(Math.random() * 3);
          const targetAngle =
            extraTurns * 360 +
            (segments.length - index) * segmentAngle -
            segmentAngle / 4;

          currentRotation += targetAngle;

          //
          disc.style.animation = "none";

          //
          disc.style.transition =
            "transform 4s cubic-bezier(0.23, 1, 0.32, 1)";
          disc.style.transform = `rotate(${currentRotation}deg)`;

          // Показуємо success-повідомлення після фактичного завершення анімації.
          let didFinishSpin = false;
          const finishSpin = function () {
            if (didFinishSpin) return;
            didFinishSpin = true;
            if (codeWrapper) {
              codeWrapper.classList.remove("vt-wheel-code-wrapper--hidden");
            }
            if (codeInput) {
              codeInput.value = code;
            }
            if (codeCopiedEl) {
              codeCopiedEl.textContent = "";
            }
            showUseCodeButton(false);
            showSuccess(successMessage);
            spinBtn.disabled = false;
            disc.removeEventListener("transitionend", onTransitionEnd);
          };
          const onTransitionEnd = function (event) {
            if (event && event.propertyName && event.propertyName !== "transform") {
              return;
            }
            finishSpin();
          };
          disc.addEventListener("transitionend", onTransitionEnd);

          // Fallback, якщо transitionend не спрацює.
          setTimeout(finishSpin, 4600);
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
              codeCopiedEl.textContent = "Скопійовано!";
            }
            hasCopied = true;
            setUseCodeButtonState(true);
            showError("");
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

















