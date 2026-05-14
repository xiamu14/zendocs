import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { isAppLanguage } from '@/lib/i18n'
import { getWorkspaceNavigation } from '@/lib/workspace-markdown'

export const Route = createFileRoute('/$lang')({
  beforeLoad: ({ params }) => {
    if (!isAppLanguage(params.lang)) throw notFound()
  },
  loader: ({ params }) => getWorkspaceNavigation({ data: { lang: params.lang } }),
  component: WorkspaceDocsLayout,
})

function WorkspaceDocsLayout() {
  const navigation = Route.useLoaderData()

  return (
    <DocsLayout
      tree={navigation.tree}
      tabs={false}
      nav={{
        title: 'Zendocs',
        url: `/${Route.useParams().lang}`,
      }}
      sidebar={{
        defaultOpenLevel: 0,
      }}
    >
      <Outlet />
    </DocsLayout>
  )
}
