import { createFileRoute } from '@tanstack/react-router'
import { getContentVersion } from '@/lib/content-events'
import { getZendocsConfigVersion } from '@/lib/config-runtime.server'

export const Route = createFileRoute('/api/content-version')({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            version: await getContentVersion(),
            configVersion: await getZendocsConfigVersion(),
          },
          {
            headers: {
              'Cache-Control': 'no-store',
            },
          },
        ),
    },
  },
})
