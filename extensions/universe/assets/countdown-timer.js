// extensions/countdown-timer/assets/countdown-timer.js
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.vtInitCountdown !== "function") {
    console.warn("vtInitCountdown is not defined");
    return;
  }

  document.querySelectorAll('[id^="vt-countdown-"]').forEach((root) => {
    window.vtInitCountdown(root);
  });
});
