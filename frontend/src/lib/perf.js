import { useEffect } from 'react';

export function useDeferredScrollSpy() {
  useEffect(() => {
    const links = Array.from(document.querySelectorAll('.top-nav a[href^="#"]'));
    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const activeId = `#${entry.target.id}`;
          links.forEach((link) => {
            link.dataset.active = String(link.getAttribute('href') === activeId);
          });
        });
      },
      { threshold: 0.55 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
}
