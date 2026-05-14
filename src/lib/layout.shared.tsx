import { defineI18nUI } from 'fumadocs-ui/i18n'
import { i18n } from '@/lib/i18n'

export const i18nUI = defineI18nUI(i18n, {
  zh: {
    displayName: '简体中文',
    search: '搜索文档',
    lastUpdate: '最后更新于',
  },
  en: {
    displayName: 'English',
    search: 'Search docs',
    lastUpdate: 'Last updated on',
  },
})
