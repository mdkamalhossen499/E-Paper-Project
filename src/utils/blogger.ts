import { NewsArticle } from '../types/epaper';
import { getDhakaEditionDate } from './dhakaTime';

export interface BloggerImportResult {
  articles: NewsArticle[];
  feedUrl: string;
  blogTitle: string;
  method: 'jsonp' | 'cors-proxy-json' | 'cors-proxy-xml' | 'manual-xml';
}

export function normalizeBlogUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function sanitizeArticleId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleaned.length >= 6 && cleaned.length <= 120) return cleaned;
  // Deterministic compact hash fallback
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `art_${Math.abs(hash).toString(36)}_${cleaned.slice(0, 40)}`.slice(0, 120);
}

function decodeHtmlEntities(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function htmlToCleanParagraphs(html: string): { text: string; firstImage: string; caption: string } {
  if (!html) return { text: '', firstImage: '', caption: '' };
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let firstImage = '';
  let caption = '';

  const img = doc.querySelector('img');
  if (img) {
    firstImage = img.getAttribute('src') || img.getAttribute('data-src') || '';
    caption = img.getAttribute('alt') || img.getAttribute('title') || '';
  }
  const figcap = doc.querySelector('figcaption, .tr-caption');
  if (figcap && figcap.textContent?.trim()) {
    caption = figcap.textContent.trim();
  }

  // Remove script/style/caption noise from body text
  doc.querySelectorAll('script, style, noscript, figcaption, .tr-caption').forEach((el) => el.remove());

  const blocks: string[] = [];
  doc.querySelectorAll('p, div, li, h2, h3, blockquote').forEach((el) => {
    if (el.children.length === 0 || el.tagName === 'P') {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length > 20 && !blocks.includes(t)) {
        blocks.push(t);
      }
    }
  });

  let text = blocks.join('\n\n');
  if (!text) {
    text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  return {
    text: decodeHtmlEntities(text).slice(0, 28000),
    firstImage: upgradeBloggerImageUrl(firstImage),
    caption: decodeHtmlEntities(caption).slice(0, 350),
  };
}

export function upgradeBloggerImageUrl(url: string): string {
  if (!url) return '';
  let normalized = url.trim();
  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  }
  // Upgrade Blogger tiny s72-c or w...-h... thumbnails to high-res print quality s1200
  normalized = normalized.replace(/\/s\d+(-c)?\//, '/s1200/');
  normalized = normalized.replace(/\/w\d+-h\d+(-p-k-no-nu)?\//, '/s1200/');
  normalized = normalized.replace(/=s\d+(-c)?$/, '=s1200');
  return normalized;
}

interface BloggerJsonEntry {
  id?: { $t?: string };
  published?: { $t?: string };
  updated?: { $t?: string };
  title?: { $t?: string };
  content?: { $t?: string };
  summary?: { $t?: string };
  link?: Array<{ rel?: string; href?: string }>;
  category?: Array<{ term?: string }>;
  author?: Array<{ name?: { $t?: string } }>;
  media$thumbnail?: { url?: string };
}

interface BloggerJsonFeed {
  feed?: {
    title?: { $t?: string };
    entry?: BloggerJsonEntry[];
  };
}

function parseBloggerJsonFeed(data: BloggerJsonFeed): { blogTitle: string; articles: NewsArticle[] } {
  const feed = data?.feed;
  const blogTitle = feed?.title?.$t || 'Blogger News';
  const entries = feed?.entry || [];

  const articles: NewsArticle[] = entries.map((entry) => {
    const rawId = entry.id?.$t || entry.link?.find((l) => l.rel === 'alternate')?.href || Math.random().toString(36);
    const title = decodeHtmlEntities(entry.title?.$t || 'শিরোনামহীন সংবাদ').trim();
    const rawHtml = entry.content?.$t || entry.summary?.$t || '';
    const parsed = htmlToCleanParagraphs(rawHtml);

    const mediaThumb = entry.media$thumbnail?.url ? upgradeBloggerImageUrl(entry.media$thumbnail.url) : '';
    const imageUrl = parsed.firstImage || mediaThumb;
    const altLink = entry.link?.find((l) => l.rel === 'alternate')?.href || '';
    const publishedAt = entry.published?.$t || entry.updated?.$t || new Date().toISOString();
    const category = entry.category?.[0]?.term || 'সাধারণ';
    const author = entry.author?.[0]?.name?.$t || 'নিজস্ব প্রতিবেদক';

    const cleanSummary = parsed.text.split('\n')[0]?.slice(0, 260) || title;

    return {
      id: sanitizeArticleId(rawId),
      title: title.slice(0, 380),
      summary: cleanSummary,
      content: parsed.text || cleanSummary,
      imageUrl,
      imageCaption: parsed.caption || title,
      url: altLink,
      publishedAt,
      dhakaEditionDate: getDhakaEditionDate(publishedAt),
      category: category.slice(0, 75),
      author: author.slice(0, 110),
      source: 'blogger',
    };
  });

  return { blogTitle, articles };
}

export function parseRssOrAtomXml(xmlString: string): { blogTitle: string; articles: NewsArticle[] } {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const parseErr = xml.querySelector('parsererror');
  if (parseErr) {
    throw new Error('Invalid RSS/Atom XML feed format.');
  }

  // Atom format (Blogger default)
  const atomEntries = Array.from(xml.querySelectorAll('feed > entry'));
  if (atomEntries.length > 0) {
    const blogTitle = xml.querySelector('feed > title')?.textContent?.trim() || 'Blogger Atom Feed';
    const articles: NewsArticle[] = atomEntries.map((entry) => {
      const rawId = entry.querySelector('id')?.textContent || Math.random().toString(36);
      const title = decodeHtmlEntities(entry.querySelector('title')?.textContent || 'শিরোনামহীন সংবাদ').trim();
      const contentHtml =
        entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || '';
      const parsed = htmlToCleanParagraphs(contentHtml);
      const mediaThumb = entry.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || '';
      const imageUrl = parsed.firstImage || upgradeBloggerImageUrl(mediaThumb);
      const altLink =
        Array.from(entry.querySelectorAll('link')).find((l) => l.getAttribute('rel') === 'alternate')?.getAttribute('href') || '';
      const publishedAt = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || new Date().toISOString();
      const category = entry.querySelector('category')?.getAttribute('term') || 'সাধারণ';
      const author = entry.querySelector('author > name')?.textContent || 'নিজস্ব প্রতিবেদক';

      const cleanSummary = parsed.text.split('\n')[0]?.slice(0, 260) || title;

      return {
        id: sanitizeArticleId(rawId),
        title: title.slice(0, 380),
        summary: cleanSummary,
        content: parsed.text || cleanSummary,
        imageUrl,
        imageCaption: parsed.caption || title,
        url: altLink,
        publishedAt,
        dhakaEditionDate: getDhakaEditionDate(publishedAt),
        category: category.slice(0, 75),
        author: author.slice(0, 110),
        source: 'blogger',
      };
    });
    return { blogTitle, articles };
  }

  // RSS 2.0 format
  const rssItems = Array.from(xml.querySelectorAll('channel > item'));
  const blogTitle = xml.querySelector('channel > title')?.textContent?.trim() || 'Blogger RSS Feed';
  const articles: NewsArticle[] = rssItems.map((item) => {
    const rawId = item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || Math.random().toString(36);
    const title = decodeHtmlEntities(item.querySelector('title')?.textContent || 'শিরোনামহীন সংবাদ').trim();
    const contentEncoded = item.getElementsByTagName('content:encoded')[0]?.textContent || '';
    const desc = item.querySelector('description')?.textContent || '';
    const parsed = htmlToCleanParagraphs(contentEncoded || desc);
    const enclosure = item.querySelector('enclosure')?.getAttribute('url') || '';
    const mediaThumb = item.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') || '';
    const imageUrl = parsed.firstImage || upgradeBloggerImageUrl(enclosure || mediaThumb);
    const link = item.querySelector('link')?.textContent?.trim() || '';
    const publishedAt = item.querySelector('pubDate')?.textContent || new Date().toISOString();
    const category = item.querySelector('category')?.textContent?.trim() || 'সাধারণ';
    const author = item.querySelector('author')?.textContent?.trim() || 'নিজস্ব প্রতিবেদক';
    const cleanSummary = parsed.text.split('\n')[0]?.slice(0, 260) || title;

    return {
      id: sanitizeArticleId(rawId),
      title: title.slice(0, 380),
      summary: cleanSummary,
      content: parsed.text || cleanSummary,
      imageUrl,
      imageCaption: parsed.caption || title,
      url: link,
      publishedAt: new Date(publishedAt).toISOString(),
      dhakaEditionDate: getDhakaEditionDate(publishedAt),
      category: category.slice(0, 75),
      author: author.slice(0, 110),
      source: 'blogger',
    };
  });

  return { blogTitle, articles };
}

function fetchViaJsonp(feedBaseUrl: string, maxResults = 60): Promise<BloggerJsonFeed> {
  return new Promise((resolve, reject) => {
    const callbackName = `__bloggerFeedCb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Blogger JSONP request timed out.'));
    }, 10000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    (window as unknown as Record<string, unknown>)[callbackName] = (payload: BloggerJsonFeed) => {
      cleanup();
      resolve(payload);
    };

    const sep = feedBaseUrl.includes('?') ? '&' : '?';
    script.src = `${feedBaseUrl}${sep}alt=json-in-script&max-results=${maxResults}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error('Blogger JSONP script failed to load.'));
    };
    document.head.appendChild(script);
  });
}

export async function importFromBloggerUrl(rawUrl: string): Promise<BloggerImportResult> {
  const baseUrl = normalizeBlogUrl(rawUrl);
  if (!baseUrl) {
    throw new Error('Please enter a valid Blogger website URL (e.g. https://yournews.blogspot.com).');
  }

  const candidateJsonFeed = `${baseUrl}/feeds/posts/default`;

  // 1. Primary: CORS-free native Blogger JSONP (works on GitHub Pages with zero backend)
  try {
    const jsonpData = await fetchViaJsonp(candidateJsonFeed, 80);
    if (jsonpData?.feed) {
      const parsed = parseBloggerJsonFeed(jsonpData);
      return {
        ...parsed,
        feedUrl: `${candidateJsonFeed}?alt=json`,
        method: 'jsonp',
      };
    }
  } catch {
    // Fall through to CORS proxy
  }

  // 2. Fallback: Public CORS proxy for custom domains or RSS/Atom feeds
  const jsonUrl = `${candidateJsonFeed}?alt=json&max-results=80`;
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(jsonUrl)}`);
    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text) as BloggerJsonFeed;
        const parsed = parseBloggerJsonFeed(data);
        return {
          ...parsed,
          feedUrl: jsonUrl,
          method: 'cors-proxy-json',
        };
      }
    }
  } catch {
    // Fall through to XML RSS/Atom endpoints
  }

  const xmlEndpoints = [
    `${baseUrl}/feeds/posts/default`,
    `${baseUrl}/feeds/posts/default?alt=rss`,
    `${baseUrl}/rss.xml`,
    `${baseUrl}/atom.xml`,
  ];

  for (const endpoint of xmlEndpoints) {
    try {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`);
      if (res.ok) {
        const xmlText = await res.text();
        if (xmlText.includes('<feed') || xmlText.includes('<rss')) {
          const parsed = parseRssOrAtomXml(xmlText);
          if (parsed.articles.length > 0) {
            return {
              ...parsed,
              feedUrl: endpoint,
              method: 'cors-proxy-xml',
            };
          }
        }
      }
    } catch {
      // Continue trying next endpoint
    }
  }

  throw new Error(
    'Could not reach a public Blogger feed at that URL. Verify the blog is public and its Blogger Site Feed is set to Full or Short, or paste the RSS/Atom XML directly.'
  );
}

export function mergeDeduplicatedArticles(
  existing: NewsArticle[],
  incoming: NewsArticle[]
): { merged: NewsArticle[]; addedCount: number } {
  const byKey = new Map<string, NewsArticle>();
  const urlSet = new Set<string>();

  for (const art of existing) {
    byKey.set(art.id, art);
    if (art.url) urlSet.add(art.url.toLowerCase().trim());
  }

  let addedCount = 0;
  for (const art of incoming) {
    const normUrl = art.url?.toLowerCase().trim();
    if (byKey.has(art.id) || (normUrl && urlSet.has(normUrl))) {
      continue;
    }
    byKey.set(art.id, art);
    if (normUrl) urlSet.add(normUrl);
    addedCount++;
  }

  const merged = Array.from(byKey.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  return { merged, addedCount };
}
