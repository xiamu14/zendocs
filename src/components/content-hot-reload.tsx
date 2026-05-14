import { useEffect } from 'react'

export function ContentHotReload() {
  useEffect(() => {
    const events = new EventSource('/api/content-events')
    events.onmessage = () => {
      window.location.reload()
    }

    return () => {
      events.close()
    }
  }, [])

  return null
}
