document.addEventListener("DOMContentLoaded", function () {
  const bgCanvas = document.getElementById("bgCanvas");
  if (bgCanvas) {
    new PredictiveArcSignal(bgCanvas, {
      background: "#000000",
      baseColor: "#B00F0F",
      accentColor: "#920213",
      highlight: "#FFFCFC",
      density: 243,
      dotSize: 243,
      speed: 26,
      signal: {
        level: 50,
        amplitude: 18,
        thickness: 100,
        wavelength: 60,
      },
    });
  }

  const overlay = document.getElementById("neonBorder");
  const card = document.getElementById("card");
  const wrapper = document.getElementById("cardWrapper");

  new NeonBorder(overlay, {
    color: "#D02C2C",
    rounded: 24,
    thickness: 6,
    borderSize: 50,
    glow: 100,
    movement: "continuous",
    speed: 16,
    onRadius: function (r) {
      card.style.borderRadius = r + "px";
      wrapper.style.borderRadius = r + "px";
    },
  });

  // Запрет скролла
  const prevent = function (e) {
    e.preventDefault();
  };

  document.addEventListener("wheel", prevent, { passive: false });
  document.addEventListener("touchmove", prevent, { passive: false });
  document.addEventListener("gesturestart", prevent, { passive: false });

  document.addEventListener(
    "keydown",
    function (e) {
      const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Space", "Home", "End"];
      if (keys.includes(e.key) && document.activeElement === document.body) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
});
