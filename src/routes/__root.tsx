import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useParams,
} from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { i18nUI } from '@/lib/layout.shared'
import fumadocsStyles from 'fumadocs-ui/style.css?url'
import fumadocsOverrides from '@/styles/fumadocs-overrides.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Zendocs' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/zantic-icon.svg' },
      { rel: 'stylesheet', href: fumadocsStyles },
      { rel: 'stylesheet', href: fumadocsOverrides },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  const { lang } = useParams({ strict: false })

  return (
    <html lang={lang ?? 'zh'} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RootProvider
          i18n={i18nUI.provider(lang)}
          search={{
            preload: false,
            options: {
              api: '/api/search',
            },
          }}
        >
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  )
}
