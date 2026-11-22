import { useEffect, useState } from 'react'

export default function useLoginCountdown(deadline) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    if (!deadline || deadline <= Date.now()) return
    const timer = setInterval(update, 250)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [deadline])
  const seconds = Math.max(0, Math.ceil(((deadline || 0) - now) / 1000))
  return { seconds, formatted: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
}
