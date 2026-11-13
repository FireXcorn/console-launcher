import type { NewsItem } from '../shared/types'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Texte brut : retire CDATA, balises (même échappées) et entités. Aucun HTML ne sort d'ici. */
export function toPlainText(s: string): string {
  const noCdata = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decode(decode(noCdata).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function field(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? m[1] : null
}

export function safeHttpsUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function itemLink(block: string): string | null {
  const text = field(block, 'link')
  if (text) {
    const url = safeHttpsUrl(toPlainText(text))
    if (url) return url
  }
  // Atom : <link href="..."/>
  const href = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block)
  if (href) {
    const url = safeHttpsUrl(decode(href[1]))
    if (url) return url
  }
  const guid = field(block, 'guid')
  return guid ? safeHttpsUrl(toPlainText(guid)) : null
}

/** Analyse un flux RSS ou Atom ; ne garde que les entrées avec titre et lien https. */
export function parseFeed(xml: string, max = 30): NewsItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? []
  const items: NewsItem[] = []
  for (const block of blocks) {
    const title = toPlainText(field(block, 'title') ?? '')
    const link = itemLink(block)
    if (!title || !link) continue
    const rawSummary =
      field(block, 'description') ?? field(block, 'summary') ?? field(block, 'content:encoded') ?? field(block, 'content') ?? ''
    let summary = toPlainText(rawSummary)
    if (summary.length > 300) summary = summary.slice(0, 297).trimEnd() + '…'
    const rawDate =
      field(block, 'pubDate') ?? field(block, 'updated') ?? field(block, 'published') ?? field(block, 'dc:date') ?? ''
    const date = Date.parse(toPlainText(rawDate))
    items.push({ title, summary, link, date: Number.isFinite(date) ? date : 0 })
  }
  return items.sort((a, b) => b.date - a.date).slice(0, max)
}
