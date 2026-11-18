import { getSetting } from '../database/db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('web-search');

/**
 * Optional, explicitly opt-in local web search adapter.
 * Disabled by default per HARKONNEN privacy architecture.
 * Uses DuckDuckGo HTML endpoint without tracking keys.
 */
export const webSearchService = {
  isEnabled() {
    return Boolean(getSetting('web_search_enabled', false));
  },

  async search(query, { maxResults = 4 } = {}) {
    if (!this.isEnabled()) {
      const err = new Error('Web search is disabled in Privacy Settings.');
      err.statusCode = 403;
      throw err;
    }

    const q = (query || '').trim();
    if (!q) return [];

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HARKONNEN-Local/1.0)',
          Accept: 'text/html',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return [];
      const html = await res.text();

      const results = [];
      const blockRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = blockRegex.exec(html)) !== null && results.length < maxResults) {
        const rawHref = match[1];
        const title = stripHtml(match[2]);
        const snippet = stripHtml(match[3]);
        const cleanUrl = decodeDuckDuckGoHref(rawHref);
        if (title && snippet) {
          results.push({
            type: 'web',
            title,
            url: cleanUrl,
            snippet,
          });
        }
      }
      return results;
    } catch (err) {
      log.warn(`Optional web search failed: ${err.message}`);
      return [];
    }
  },
};

function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeDuckDuckGoHref(href) {
  try {
    const parsed = new URL(href.startsWith('//') ? 'https:' + href : href);
    const uddg = parsed.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : parsed.toString();
  } catch {
    return href;
  }
}
