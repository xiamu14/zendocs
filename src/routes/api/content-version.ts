import { createFileRoute } from '@tanstack/react-router'
import { getContentVersion } from '@/lib/content-events'

export const Route = createFileRoute('/api/content-version')({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { version: await getContentVersion() },
          {
            headers: {
              'Cache-Control': 'no-store',
            },
          },
        ),
    },
  },
})
