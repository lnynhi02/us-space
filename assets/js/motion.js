
/* motion.js: count-up, pops, gate shake. Works alongside script.js without changing it. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Count-up for the day counters, once per element
  const done = new WeakSet();
  const counterObs = new MutationObserver(() => {
    document.querySelectorAll("[data-days]").forEach(e => {
      const target = parseInt(e.textContent.replace(/\D/g, ""), 10);
      if (done.has(e) || isNaN(target)) return;
      done.add(e);
      if (reduce || target < 2) return;
      const t0 = performance.now(), dur = 1100;
      const step = now => {
        const p = Math.min((now - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
        counterObs.disconnect();
        e.textContent = Math.round(target * eased).toLocaleString();
        counterObs.observe(document.body, { childList: true, subtree: true, characterData: true });
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  counterObs.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Pop on hearts and mood buttons
  document.addEventListener("click", ev => {
    const b = ev.target.closest(".heart, .moods button");
    if (!b) return;
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
  });

  // Shake the gate card when the error appears
  const err = document.getElementById("gateError"), card = document.getElementById("gateForm");
  if (err && card) {
    new MutationObserver(() => {
      if (err.hidden) return;
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    }).observe(err, { attributes: true, attributeFilter: ["hidden"], childList: true });
  }
})();
