document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[id^="vt-countdown-"]').forEach((root) => {
      const end = new Date();
      end.setDate(end.getDate() + 2); // +2 дні
  
      function updateCountdown() {
        const now = new Date().getTime();
        let diff = end.getTime() - now;
        if (diff < 0) diff = 0;
  
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
  
        root.querySelector('[data-unit="days"]').textContent = String(days).padStart(2, '0');
        root.querySelector('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
        root.querySelector('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
        root.querySelector('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');
      }
  
      updateCountdown();
      setInterval(updateCountdown, 1000);
    });
  });
  