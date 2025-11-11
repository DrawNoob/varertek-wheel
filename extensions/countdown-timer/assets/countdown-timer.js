document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[id^="vt-countdown-"]').forEach((root) => {
        const endAttr = root.getAttribute("data-end");
        if (endAttr) {
          end = new Date(endAttr);
        } else {
        end = new Date();
        end.setDate(end.getDate() + 2);
      }
  
      function updateCountdown() {
        const now = Date.now();
        let diff = end.getTime() - now;
        if (diff < 0) diff = 0;
  
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
  
        const dEl = root.querySelector('[data-unit="days"]');
        const hEl = root.querySelector('[data-unit="hours"]');
        const mEl = root.querySelector('[data-unit="minutes"]');
        const sEl = root.querySelector('[data-unit="seconds"]');
  
        if (dEl) dEl.textContent = String(days).padStart(2, "0");
        if (hEl) hEl.textContent = String(hours).padStart(2, "0");
        if (mEl) mEl.textContent = String(minutes).padStart(2, "0");
        if (sEl) sEl.textContent = String(seconds).padStart(2, "0");
      }
  
      updateCountdown();
      setInterval(updateCountdown, 1000);
    });
  });
  