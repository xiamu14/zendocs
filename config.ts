import type { ZendocsConfig } from './src/lib/zendocs-config'

const config = {
  readDirectory: '/Users/ben/Documents/workspace',
  filterFiles: [
    /^(readme(?:[._-].*)?|licen[cs]e|licence|changelog|contribut(?:ion|ing)|thanks)(?:[._-].*)?$/i,
  ],
  filterDirectories: [
    '.cache',
    '.claude',
    '.codex',
    '.gradle',
    '.output',
    '.pnpm-store',
    '.tanstack',
    '.vite',
    '.vinxi',
    '.yarn',
    'DerivedData',
    'build',
    'coverage',
    'dist',
    'Library',
    'node_modules',
    'target',
  ],
  maxFileSizeBytes: 1024 * 1024,
} satisfies ZendocsConfig

export default config
