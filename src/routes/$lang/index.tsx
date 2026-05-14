import { createFileRoute, redirect } from '@tanstack/react-router'
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import { getWorkspaceNavigation } from '@/lib/workspace-markdown'

export const Route = createFileRoute('/$lang/')({
  loader: async ({ params }) => {
    const navigation = await getWorkspaceNavigation({ data: { lang: params.lang } })

    if (navigation.firstUrl) {
      throw redirect({ href: navigation.firstUrl })
    }

    return navigation
  },
  component: EmptyWorkspacePage,
})

function EmptyWorkspacePage() {
  return (
    <DocsPage toc={[]} footer={{ enabled: false }}>
      <DocsTitle>No Markdown files</DocsTitle>
      <DocsBody>
        <p>No matching Markdown files were found in the workspace.</p>
      </DocsBody>
    </DocsPage>
  )
}
