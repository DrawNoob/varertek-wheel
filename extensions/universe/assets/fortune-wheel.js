(function () {
    const PROXY_URL = "/apps/vadertek-timer";
  
    function initWheelOverlays() {
      var overlays = document.querySelectorAll("[data-vt-wheel-overlay]");
      if (!overlays.length) return;
  
      overlays.forEach(function (overlay) {
        var uid = overlay.getAttribute("data-uid");
        var closeBtn = overlay.querySelector(".vt-wheel-close");
        var spinBtn = overlay.querySelector(".vt-wheel-spin-btn");
        var disc = overlay.querySelector(".vt-wheel-disc");
        var trigger = document.querySelector(".vt-wheel-trigger-" + uid);
        var emailInput = overlay.querySelector(".vt-wheel-email-input");
        var errorEl = overlay.querySelector("[data-vt-wheel-error]");
        var successEl = overlay.querySelector("[data-vt-wheel-success]");
        var attrEmail = overlay.getAttribute("data-email") || "";
        var errorMessage =
          overlay.getAttribute("data-error-message") ||
          "Введіть коректний email, щоб крутити колесо.";
        var successMessage =
          overlay.getAttribute("data-success-message") ||
          "Ви успішно прокрутили колесо!";
        var usedMessage = "Цей email вже використовувався.";
  
        function showError(msg) {
          if (errorEl) errorEl.textContent = msg || "";
        }
  
        function showSuccess(msg) {
          if (successEl) successEl.textContent = msg || "";
        }
  
        function getEmail() {
          var inputValue = emailInput ? emailInput.value.trim() : "";
          return inputValue || attrEmail;
        }
  
        function isValidEmail(value) {
          if (!value) return false;
          return /\S+@\S+\.\S+/.test(value);
        }
  
        async function checkIfCustomerExists(email) {
          try {
            const res = await fetch(PROXY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                check_customer: true,
                email
              })
            });
  
            const data = await res.json();
            return data.exists === true;
          } catch (err) {
            console.error("Customer check error", err);
            return false;
          }
        }
  
        function sendSpinEvent(email) {
          var deviceType = window.innerWidth < 768 ? "Mobile" : "Desktop";
  
          var payload = JSON.stringify({
            email,
            answer: "wheel-spin",
            device_type: deviceType
          });
  
          fetch(PROXY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: payload
          }).catch(function (err) {
            console.error("Wheel of fortune error", err);
          });
        }
  
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
  
        // показати попап через 3 секунди після завантаження
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
  
        // Кнопка "Крутити"
        if (spinBtn && disc) {
          spinBtn.addEventListener("click", async function () {
            var email = getEmail();
  
            // 1. Перевірка формату
            if (!isValidEmail(email)) {
              showSuccess("");
              showError(errorMessage);
              return;
            }
  
            // 2. Перевірка чи не існує вже емейл у кастомерах/таблиці
            const exists = await checkIfCustomerExists(email);
            if (exists) {
              showSuccess("");
              showError(usedMessage);
              return;
            }
  
            // окей
            showError("");
            showSuccess(successMessage);
            sendSpinEvent(email);
  
            // 3. Анімація колеса
            disc.classList.remove("vt-wheel-disc--spinning");
            void disc.offsetWidth; // перезапустити анімацію
            disc.classList.add("vt-wheel-disc--spinning");
          });
        }
      });
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initWheelOverlays);
    } else {
      initWheelOverlays();
    }
  })();
  