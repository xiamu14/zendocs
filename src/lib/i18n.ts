import { defineI18n } from 'fumadocs-core/i18n'

export const i18n = defineI18n({
  defaultLanguage: 'zh',
  languages: ['zh', 'en'],
})

export type AppLanguage = (typeof i18n.languages)[number]

export function isAppLanguage(value: string): value is AppLanguage {
  return i18n.languages.includes(value as AppLanguage)
}
