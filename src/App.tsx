import { useEffect, useMemo, useState } from 'react'
import { Lobby } from './components/lobby/Lobby'
import { Town } from './components/town/Town'
import { describe } from './hooks/useConversations'
import { loadProfile, resolveProfile, saveProfile } from './lib/profileStore'
import { createTransport, type Profile } from './transport'

type Phase = { name: 'lobby'; error: string | null } | { name: 'connecting' } | { name: 'town'; profile: Profile }

const isFreshWindow = (): boolean => new URLSearchParams(window.location.search).get('fresh') === '1'

export default function App() {
  const transport = useMemo(() => createTransport(), [])
  const [stored, setStored] = useState(() => (isFreshWindow() ? null : loadProfile()))
  const [phase, setPhase] = useState<Phase>({ name: 'lobby', error: null })

  // Say goodbye so other players drop our avatar immediately instead of waiting for a timeout.
  // A page restored from the back/forward cache has a disconnected transport; start fresh.
  useEffect(() => {
    const bye = () => void transport.disconnect()
    const restore = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }
    window.addEventListener('pagehide', bye)
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pagehide', bye)
      window.removeEventListener('pageshow', restore)
    }
  }, [transport])

  const enter = async (name: string, avatar: number) => {
    const profile = resolveProfile(name, avatar, stored, isFreshWindow())
    setPhase({ name: 'connecting' })
    try {
      await transport.connect(profile)
      if (!isFreshWindow()) saveProfile(profile)
      setStored(profile)
      setPhase({ name: 'town', profile })
    } catch (err) {
      setPhase({ name: 'lobby', error: `Couldn't reach CometChat: ${describe(err)}` })
    }
  }

  const leave = async () => {
    await transport.disconnect()
    setPhase({ name: 'lobby', error: null })
  }

  if (phase.name === 'town') return <Town transport={transport} profile={phase.profile} onLeave={leave} />

  return (
    <Lobby
      initialName={stored?.name ?? ''}
      initialAvatar={stored?.avatar ?? 0}
      mode={transport.mode}
      busy={phase.name === 'connecting'}
      error={phase.name === 'lobby' ? phase.error : null}
      onEnter={enter}
    />
  )
}
