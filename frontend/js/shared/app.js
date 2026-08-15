// ==========================================
// SCROLL REVEAL ANIMATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const revealElements = document.querySelectorAll(
    ".feature-card, .how-step, .why-list li, .why-stat, .cta-box",
  );

  revealElements.forEach((element) => {
    element.classList.add("reveal");
  });

  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
    },
  );

  revealElements.forEach((element) => {
    observer.observe(element);
  });
});
