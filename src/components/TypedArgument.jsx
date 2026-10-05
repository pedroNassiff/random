import { useEffect, useState } from 'react';

const DELETE_MS = 35;
const TYPE_MS = 60;

/**
 * Escribe `text` como si se tipeara: borra lo anterior letra por letra y escribe lo nuevo.
 * Con "reducir movimiento" activado, cambia de golpe.
 */
export default function TypedArgument({ text }) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(text);
      return undefined;
    }
    let current = shown;
    let timer = 0;
    const step = () => {
      if (!text.startsWith(current)) {
        current = current.slice(0, -1); // borrar hasta quedar con un prefijo común
        setShown(current);
        timer = window.setTimeout(step, DELETE_MS);
      } else if (current.length < text.length) {
        current = text.slice(0, current.length + 1);
        setShown(current);
        timer = window.setTimeout(step, TYPE_MS);
      }
    };
    timer = window.setTimeout(step, DELETE_MS);
    return () => window.clearTimeout(timer);
    // Solo reacciona al texto pedido; `shown` es el punto de partida de la animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span className="random-arg">
      {shown}
      {shown !== text && <span className="random-caret" aria-hidden="true" />}
    </span>
  );
}
