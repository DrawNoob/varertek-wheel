(function () {
    function initWheelOverlays() {
      var overlays = document.querySelectorAll("[data-vt-wheel-overlay]");
      if (!overlays.length) return;
  
      overlays.forEach(function (overlay) {
        var uid = overlay.getAttribute("data-uid");
        var closeBtn = overlay.querySelector(".vt-wheel-close");
        var spinBtn = overlay.querySelector(".vt-wheel-spin-btn");
        var disc = overlay.querySelector(".vt-wheel-disc");
        var trigger = document.querySelector(".vt-wheel-trigger-" + uid);
  
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
  
        // Закрити по кнопці
        if (closeBtn) {
          closeBtn.addEventListener("click", closeOverlay);
        }
  
        // Закрити по кліку на затемнений фон (але не на модалці)
        overlay.addEventListener("click", function (e) {
          if (e.target === overlay) {
            closeOverlay();
          }
        });
  
        // Клік по стікному тригеру — знову відкриває
        if (trigger) {
          trigger.addEventListener("click", openOverlay);
        }
  
        // Проста анімація "крутити" — просто прокрутка колеса
        if (spinBtn && disc) {
          spinBtn.addEventListener("click", function () {
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
  