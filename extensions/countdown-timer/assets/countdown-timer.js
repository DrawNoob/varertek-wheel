// extensions/countdown-timer/assets/countdown-timer.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('[id^="vt-countdown-"]').forEach((root) => {
    let end;

    const endAttr = root.getAttribute("data-end");
    if (endAttr) {
      end = new Date(endAttr);
    } else {
      // якщо нема метафілду - за замовчуванням +2 дні
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

    // ---- ВІДПРАВКА ВІДПОВІДІ В APP ----
    function sendAnswer(answer) {
      const email = root.getAttribute("data-email") || "";
    
      const PROXY_URL = "https://varertek-wheel.onrender.com/proxy/countdown-answer";
    
      const payload = JSON.stringify({ email, answer });
    
      fetch(PROXY_URL, {
        method: "POST",
        // text/plain — "simple" контент-тайп, не буде preflight OPTIONS
        headers: {
          "Content-Type": "text/plain",
        },
        body: payload,
      }).catch((err) => {
        console.error("Countdown answer error", err);
      });
    }
    
    
    

    const yesBtn = root.querySelector('.ask_btn[data-answer="yes"]');
    const noBtn = root.querySelector('.ask_btn[data-answer="no"]');

    if (yesBtn) {
      yesBtn.addEventListener("click", () => {
        sendAnswer("yes");
      });
    }
    if (noBtn) {
      noBtn.addEventListener("click", () => {
        sendAnswer("no");
      });
    }

    // ---- СТАРТ ТАЙМЕРА ----
    updateCountdown();
    setInterval(updateCountdown, 1000);
  });
});
