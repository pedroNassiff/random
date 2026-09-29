/**
 * Avatar de vaca propio (no es el logo de La Vaca: DESIGN §1, "Marca").
 * Con permiso escrito, se reemplaza pasando `src` con la imagen oficial.
 */
export function CowAvatar({ size = 56, src }: { size?: number; src?: string }) {
  if (src) return <img src={src} width={size} height={size} alt="" className="vf-cow" />
  return (
    <svg className="vf-cow" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#fff" stroke="#000" strokeWidth="2" />
      <path d="M14 18 L8 8 L20 14 Z M50 18 L56 8 L44 14 Z" fill="#fde761" stroke="#000" strokeWidth="1.5" />
      <ellipse cx="11" cy="26" rx="7" ry="4" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <ellipse cx="53" cy="26" rx="7" ry="4" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <path d="M18 14 Q24 10 30 16 Q26 24 18 22 Z" fill="#000" />
      <path d="M44 30 Q52 28 52 36 Q46 40 42 36 Z" fill="#000" />
      <circle cx="24" cy="30" r="3" fill="#000" />
      <circle cx="40" cy="30" r="3" fill="#000" />
      <ellipse cx="32" cy="46" rx="14" ry="9" fill="#f7b6c8" stroke="#000" strokeWidth="1.5" />
      <circle cx="27" cy="46" r="2" fill="#000" />
      <circle cx="37" cy="46" r="2" fill="#000" />
    </svg>
  )
}
