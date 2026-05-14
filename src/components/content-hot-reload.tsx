import { useEffect } from 'react'

type ContentVersionResponse = {
  version: string
}

export function ContentHotReload() {
  useEffect(() => {
    let currentVersion: string | null = null
    let disposed = false

    async function checkContentVersion() {
      try {
        const response = await fetch('/api/content-version', {
          cache: 'no-store',
        })
        if (!response.ok) return

        const data = (await response.json()) as ContentVersionResponse
        if (disposed) return

        if (currentVersion === null) {
          currentVersion = data.version
          return
        }

        if (data.version !== currentVersion) {
          window.location.reload()
        }
      } catch {
        // Ignore transient network errors; the next poll will retry.
      }
    }

    void checkContentVersion()
    const timer = window.setInterval(checkContentVersion, 1000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  return null
}
