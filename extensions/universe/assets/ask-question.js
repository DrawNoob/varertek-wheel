// extensions/countdown-survey/assets/countdown-survey.js
(function () {
  const PROXY_URL = "/apps/vadertek-timer";

  function initSurvey(root) {
    function sendAnswer(answer) {
      const emailInput = root.querySelector(".vt-survey-email-input");
      const inputValue = emailInput ? emailInput.value.trim() : "";
      const attrEmail = root.getAttribute("data-email") || "";
      const email = inputValue || attrEmail;

      const deviceType = window.innerWidth < 768 ? "Mobile" : "Desktop";

      const payload = JSON.stringify({
        email,
        answer,
        device_type: deviceType
      });

      fetch(PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: payload
      }).catch((err) => {
        console.error("Countdown survey error", err);
      });
    }

    const yesBtn = root.querySelector('.vt-survey-btn[data-answer="yes"]');
    const noBtn = root.querySelector('.vt-survey-btn[data-answer="no"]');

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
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-vt-survey]").forEach((root) => {
      initSurvey(root);
    });
  });
})();
