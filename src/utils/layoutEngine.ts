import {
  NewsArticle,
  NewspaperAd,
  NewspaperEdition,
  NewspaperPage,
  PageArticleSlot,
  PaperFormat,
  PaperOrientation,
} from '../types/epaper';
import { DEFAULT_ADS } from '../data/defaultData';

function extractBulletPoints(content: string, summary: string): string[] {
  const source = (content || summary || '').replace(/\n+/g, ' ');
  const sentences = source
    .split(/[।.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18 && s.length <= 120);

  return sentences.slice(0, 2);
}

function createSlotFromArticle(
  article: NewsArticle,
  index: number,
  config: {
    colSpan: number;
    rowSpan: number;
    role: PageArticleSlot['role'];
    imagePosition: PageArticleSlot['imagePosition'];
    imageHeightPx: number;
    headlinePosition: PageArticleSlot['headlinePosition'];
    headlineScale: PageArticleSlot['headlineScale'];
    includeBullets?: boolean;
    continuationText?: string;
  }
): PageArticleSlot {
  return {
    slotId: `slot_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    articleId: article.id,
    colSpan: config.colSpan,
    rowSpan: config.rowSpan,
    role: config.role,
    showImage: Boolean(article.imageUrl) && config.imagePosition !== 'none',
    imagePosition: article.imageUrl ? config.imagePosition : 'none',
    imageHeightPx: config.imageHeightPx,
    headlinePosition: config.headlinePosition,
    headlineScale: config.headlineScale,
    customTitle: article.title,
    customContent: article.content || article.summary,
    customCaption: article.imageCaption || '',
    customAuthor: article.author || 'নিজস্ব প্রতিবেদক',
    customCategory: article.category || 'জাতীয়',
    bulletPoints: config.includeBullets ? extractBulletPoints(article.content, article.summary) : [],
    continuationText: config.continuationText || '',
  };
}

const SECTION_TITLES = [
  'প্রথম পাতা',
  'জাতীয় ও রাজনীতি',
  'দেশজুড়ে ও অর্থনীতি',
  'আন্তর্জাতিক ও বিশ্লেষণ',
  'খেলাধুলা ও বিনোদন',
  'সম্পাদকীয় ও বিবিধ',
];

/**
 * Arranges selected news articles into multi-page traditional Bangladeshi newspaper pages.
 * Every page follows the same broadsheet design language as the reference image.
 */
export function generateNewspaperEdition(params: {
  articles: NewsArticle[];
  mainHeadlineArticleId?: string;
  editionDate: string;
  editionNumber: number;
  title: string;
  format: PaperFormat;
  orientation: PaperOrientation;
  showAds: boolean;
  existingAds?: NewspaperAd[];
}): NewspaperEdition {
  const {
    articles,
    mainHeadlineArticleId,
    editionDate,
    editionNumber,
    title,
    format,
    orientation,
    showAds,
    existingAds,
  } = params;

  if (articles.length === 0) {
    return {
      id: `ed_${editionDate}_${editionNumber}`,
      editionDate,
      editionNumber,
      title,
      format,
      orientation,
      totalPages: 1,
      published: false,
      pages: [
        {
          pageNumber: 1,
          sectionTitle: 'প্রথম পাতা',
          isFrontPage: true,
          slots: [],
          showAdsOnPage: showAds,
        },
      ],
      ads: existingAds && existingAds.length > 0 ? existingAds : DEFAULT_ADS,
    };
  }

  // Put chosen main headline article first
  const ordered = [...articles];
  if (mainHeadlineArticleId) {
    const idx = ordered.findIndex((a) => a.id === mainHeadlineArticleId);
    if (idx > 0) {
      const [lead] = ordered.splice(idx, 1);
      ordered.unshift(lead);
    }
  }

  const totalCols = orientation === 'landscape' ? 8 : 6;
  const maxArticlesPerPage = orientation === 'landscape' ? 7 : 6;

  const pages: NewspaperPage[] = [];
  let cursor = 0;
  let pageNumber = 1;

  while (cursor < ordered.length) {
    const isFrontPage = pageNumber === 1;
    const chunk = ordered.slice(cursor, cursor + maxArticlesPerPage);
    cursor += chunk.length;

    const slots: PageArticleSlot[] = [];

    if (chunk.length === 1) {
      slots.push(
        createSlotFromArticle(chunk[0], 0, {
          colSpan: totalCols,
          rowSpan: 2,
          role: 'lead',
          imagePosition: 'top',
          imageHeightPx: isFrontPage ? 260 : 240,
          headlinePosition: 'below-image',
          headlineScale: 'xl',
          includeBullets: true,
        })
      );
    } else if (chunk.length === 2) {
      slots.push(
        createSlotFromArticle(chunk[0], 0, {
          colSpan: orientation === 'landscape' ? 5 : 4,
          rowSpan: 2,
          role: 'lead',
          imagePosition: 'top',
          imageHeightPx: 230,
          headlinePosition: 'below-image',
          headlineScale: 'xl',
          includeBullets: true,
        }),
        createSlotFromArticle(chunk[1], 1, {
          colSpan: orientation === 'landscape' ? 3 : 2,
          rowSpan: 2,
          role: 'sublead',
          imagePosition: 'top',
          imageHeightPx: 140,
          headlinePosition: 'top',
          headlineScale: 'lg',
          includeBullets: true,
        })
      );
    } else {
      // Traditional Bangladeshi broadsheet reference layout:
      // 1) Dominant Lead Story (left 3 or 4 cols, image above big headline, red bullets)
      const leadCols = orientation === 'landscape' ? 4 : 3;
      const midCols = orientation === 'landscape' ? 2 : 1;
      const rightCols = totalCols - leadCols - midCols; // 2 cols in both portrait (6-3-1=2) and landscape (8-4-2=2)

      slots.push(
        createSlotFromArticle(chunk[0], 0, {
          colSpan: leadCols,
          rowSpan: 2,
          role: 'lead',
          imagePosition: 'top',
          imageHeightPx: isFrontPage ? 210 : 190,
          headlinePosition: 'below-image',
          headlineScale: 'xl',
          includeBullets: true,
          continuationText: pages.length > 0 ? '' : 'বিস্তারিত ভেতরের পাতায়',
        })
      );

      // 2) Middle vertical sidebar story
      if (chunk[1]) {
        slots.push(
          createSlotFromArticle(chunk[1], 1, {
            colSpan: midCols === 1 ? 1 : 2,
            rowSpan: 2,
            role: 'sidebar',
            imagePosition: 'top',
            imageHeightPx: 90,
            headlinePosition: 'top',
            headlineScale: 'md',
            includeBullets: false,
          })
        );
      }

      // 3) Right column featured story (and optional stacked story below it if 7 articles on page)
      const hasRightStack = chunk.length >= 7;
      if (chunk[2]) {
        slots.push(
          createSlotFromArticle(chunk[2], 2, {
            colSpan: rightCols,
            rowSpan: hasRightStack ? 1 : 2,
            role: 'sublead',
            imagePosition: 'right',
            imageHeightPx: hasRightStack ? 95 : 120,
            headlinePosition: 'top',
            headlineScale: 'lg',
            includeBullets: true,
          })
        );
      }

      if (hasRightStack && chunk[3]) {
        slots.push(
          createSlotFromArticle(chunk[3], 3, {
            colSpan: rightCols,
            rowSpan: 1,
            role: 'secondary',
            imagePosition: 'none',
            imageHeightPx: 90,
            headlinePosition: 'top',
            headlineScale: 'md',
            includeBullets: true,
          })
        );
      }

      // 4) Remaining lower stories filling the bottom row symmetrically
      const remaining = hasRightStack ? chunk.slice(4) : chunk.slice(3);
      if (remaining.length === 1) {
        slots.push(
          createSlotFromArticle(remaining[0], 4, {
            colSpan: totalCols,
            rowSpan: 1,
            role: 'bottom-anchor',
            imagePosition: 'right',
            imageHeightPx: 120,
            headlinePosition: 'top',
            headlineScale: 'lg',
            includeBullets: true,
          })
        );
      } else if (remaining.length === 2) {
        slots.push(
          createSlotFromArticle(remaining[0], 4, {
            colSpan: Math.floor(totalCols / 2),
            rowSpan: 1,
            role: 'secondary',
            imagePosition: 'right',
            imageHeightPx: 110,
            headlinePosition: 'top',
            headlineScale: 'md',
          }),
          createSlotFromArticle(remaining[1], 5, {
            colSpan: Math.ceil(totalCols / 2),
            rowSpan: 1,
            role: 'bottom-anchor',
            imagePosition: 'left',
            imageHeightPx: 110,
            headlinePosition: 'top',
            headlineScale: 'md',
            includeBullets: true,
          })
        );
      } else if (remaining.length >= 3) {
        const firstTwoSpan = orientation === 'landscape' ? 3 : 2;
        const thirdSpan = totalCols - firstTwoSpan * 2;
        slots.push(
          createSlotFromArticle(remaining[0], 4, {
            colSpan: firstTwoSpan,
            rowSpan: 1,
            role: 'secondary',
            imagePosition: 'top',
            imageHeightPx: 95,
            headlinePosition: 'top',
            headlineScale: 'md',
          }),
          createSlotFromArticle(remaining[1], 5, {
            colSpan: firstTwoSpan,
            rowSpan: 1,
            role: 'secondary',
            imagePosition: 'right',
            imageHeightPx: 95,
            headlinePosition: 'top',
            headlineScale: 'md',
          }),
          createSlotFromArticle(remaining[2], 6, {
            colSpan: thirdSpan,
            rowSpan: 1,
            role: 'bottom-anchor',
            imagePosition: 'left',
            imageHeightPx: 95,
            headlinePosition: 'top',
            headlineScale: 'md',
            includeBullets: true,
          })
        );
      }
    }

    pages.push({
      pageNumber,
      sectionTitle: SECTION_TITLES[(pageNumber - 1) % SECTION_TITLES.length],
      isFrontPage,
      slots,
      showAdsOnPage: showAds && (isFrontPage || pageNumber % 2 === 1),
    });

    pageNumber++;
  }

  return {
    id: `ed_${editionDate.replace(/-/g, '')}_${editionNumber}`,
    editionDate,
    editionNumber,
    title,
    format,
    orientation,
    totalPages: pages.length,
    published: true,
    pages,
    ads: existingAds && existingAds.length > 0 ? existingAds : DEFAULT_ADS,
  };
}
