/** Barra de % de victoria (DESIGN §5), con los porcentajes en texto (no depende solo del color). */
export function WinBar({ names, pctA, pctB }: { names: [string, string]; pctA: number; pctB: number }) {
  return (
    <div className="vf-winbar" role="img" aria-label={`${names[0]} ${pctA}%, ${names[1]} ${pctB}%`}>
      <span className="vf-winbar__a vf-pixel" style={{ width: `${pctA}%` }}>
        {pctA}%
      </span>
      <span className="vf-winbar__b vf-pixel" style={{ width: `${pctB}%` }}>
        {pctB}%
      </span>
    </div>
  )
}
