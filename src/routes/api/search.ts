import { createFileRoute } from '@tanstack/react-router'
import { i18n } from '@/lib/i18n'
import { isAppLanguage } from '@/lib/i18n'
import { searchWorkspaceMarkdownServer } from '@/lib/workspace-markdown'

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('query') ?? ''
        const locale = url.searchParams.get('locale') ?? i18n.defaultLanguage
        const limitParam = url.searchParams.get('limit')
        const limit = limitParam === null ? undefined : Number(limitParam)
        const tag = url.searchParams.get('tag') ?? ''

        return Response.json(
          await searchWorkspaceMarkdownServer({
            data: {
              lang: isAppLanguage(locale) ? locale : i18n.defaultLanguage,
              query,
              filter: tag || undefined,
              limit: limit !== undefined && Number.isInteger(limit) ? limit : undefined,
            },
          }),
        )
      },
    },
  },
})
