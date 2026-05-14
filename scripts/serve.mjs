import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import app from '../dist/server/server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const clientRoot = path.join(root, 'dist/client')
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
])

async function staticResponse(url) {
  const decodedPath = decodeURIComponent(url.pathname)
  const cleanPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(clientRoot, cleanPath)
  const relativePath = path.relative(clientRoot, filePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }

  try {
    const fileInfo = await stat(filePath)
    if (!fileInfo.isFile()) return null

    return new Response(Bun.file(filePath), {
      headers: {
        'Cache-Control': cleanPath.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0',
        'Content-Length': String(fileInfo.size),
        'Content-Type':
          mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
      },
    })
  } catch {
    return null
  }
}

async function appResponse(request) {
  const response = await app.fetch(request)
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!contentType.includes('text/html')) return response

  return new Response(await response.text(), {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
}

Bun.serve({
  hostname: host,
  port,
  async fetch(request) {
    const url = new URL(request.url)
    const staticFile = await staticResponse(url)

    return staticFile ?? appResponse(request)
  },
})

console.log(`Zendocs is running at http://${host}:${port}`)
