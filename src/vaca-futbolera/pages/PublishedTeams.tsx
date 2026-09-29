import { useCallback } from 'react'
import { api } from '../api'
import { SectionHeader } from '../components/SectionHeader'
import { ShareSheet } from '../components/ShareSheet'
import { matchDay, matchTime } from '../match'
import { sheetTeams } from '../teams'
import { useLoad } from '../useLoad'

/** Pantalla VS en la pestaña Partido cuando hay equipos publicados (DESIGN §6, spec §7). */
export function PublishedTeams({ matchId }: { matchId: string }) {
  const loader = useCallback(() => api.teams(matchId), [matchId])
  const { data, error } = useLoad(loader)
  if (error) return <p className="vf-error">{error}</p>
  if (!data?.published || !data.share_text) return null
  const heading = `${matchDay(data.match.starts_at)} · ${matchTime(data.match.starts_at)}`
  return (
    <>
      <SectionHeader>Equipos</SectionHeader>
      <ShareSheet heading={heading} teams={sheetTeams(data, data.published)} text={data.share_text} />
    </>
  )
}
