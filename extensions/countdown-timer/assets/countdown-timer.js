// extensions/countdown-timer/assets/countdown-timer.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('[id^="vt-countdown-"]').forEach((root) => {
    let end;

    const endAttr = root.getAttribute("data-end");

    if (endAttr) {
      // Якщо раптом передаєш дату з метафілда — рахуємо до неї
      end = new Date(endAttr);
    } else {
      // Інакше — рахуємо до наступного Нового року (1 січня наступного року, 00:00)
      const now = new Date();
      const nextYear = now.getFullYear() + 1;
      // 1 січня nextYear, 00:00
      end = new Date(nextYear, 0, 1, 0, 0, 0);
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

    function sendAnswer(answer) {
      // 1) шукаємо інпут всередині конкретного блоку
      const emailInput = root.querySelector(".vt-countdown-email-input");
      const inputValue = emailInput ? emailInput.value.trim() : "";
    
      // 2) fallback — customer.email з Liquid-атрибуту, якщо інпут порожній
      const attrEmail = root.getAttribute("data-email") || "";
    
      const email = inputValue || attrEmail;
    
      const PROXY_URL = "/apps/vadertek-timer";
    
      const payload = JSON.stringify({ email, answer });
    
      fetch(PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
