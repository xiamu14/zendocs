import { createFileRoute } from '@tanstack/react-router'
import type { ContentEvent } from '@/lib/content-events'

export const Route = createFileRoute('/api/content-events')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { subscribeToContentEvents } = await import(
          '@/lib/content-events'
        )
        const encoder = new TextEncoder()
        let unsubscribe: (() => void) | undefined
        let keepAlive: ReturnType<typeof setInterval> | undefined

        const stream = new ReadableStream({
          start(controller) {
            const send = (event: ContentEvent) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
              )
            }

            controller.enqueue(encoder.encode(': connected\n\n'))

            unsubscribe = subscribeToContentEvents(send)
            keepAlive = setInterval(() => {
              controller.enqueue(encoder.encode(': keep-alive\n\n'))
            }, 30000)

            request.signal.addEventListener('abort', () => {
              unsubscribe?.()
              if (keepAlive) clearInterval(keepAlive)
              controller.close()
            })
          },
          cancel() {
            unsubscribe?.()
            if (keepAlive) clearInterval(keepAlive)
          },
        })

        return new Response(stream, {
          headers: {
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
          },
        })
      },
    },
  },
})
