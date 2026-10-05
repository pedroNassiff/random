import { useEffect, useState } from 'react';

/**
 * Devuelve el id de la sección que cruza la franja central de la pantalla (o null si ninguna, p. ej. el hero).
 * Usa IntersectionObserver: no escucha el scroll ni mide en cada frame.
 */
export default function useActiveSection(ids, enabled = true) {
  const [active, setActive] = useState(null);
  const key = ids.join(',');

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        // Si en la franja hay dos secciones (borde entre ambas), gana la que va primero en la página.
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      // Franja de detección: una línea horizontal a ~40% del alto de la pantalla.
      { rootMargin: '-40% 0px -59% 0px' },
    );
    // Las secciones pueden montarse después que el navbar: se reintenta hasta encontrarlas.
    let raf = 0;
    const attach = () => {
      const elements = ids.map((id) => document.getElementById(id)).filter(Boolean);
      if (elements.length < ids.length) raf = requestAnimationFrame(attach);
      elements.forEach((el) => observer.observe(el));
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      setActive(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return active;
}
