import {
  NewsArticle,
  NewspaperAd,
  NewspaperEdition,
  NewspaperPage,
  NewspaperTemplateId,
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
    slotStyle?: PageArticleSlot['slotStyle'];
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
    slotStyle: config.slotStyle || 'default',
  };
}

function buildSlotsForTemplatePage(
  templateId: NewspaperTemplateId,
  chunk: NewsArticle[],
  totalCols: number,
  orientation: PaperOrientation,
  isFrontPage: boolean
): PageArticleSlot[] {
  const isLand = orientation === 'landscape';
  if (chunk.length === 1) {
    return [
      createSlotFromArticle(chunk[0], 0, {
        colSpan: totalCols,
        rowSpan: 2,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: isFrontPage ? 250 : 220,
        headlinePosition: templateId === 'template-06' ? 'top' : 'below-image',
        headlineScale: 'xl',
        includeBullets: true,
        slotStyle: templateId === 'template-06' ? 'framed-teal' : 'default',
      }),
    ];
  }

  if (chunk.length === 2) {
    const leftSpan = isLand ? 5 : 4;
    const rightSpan = totalCols - leftSpan;
    return [
      createSlotFromArticle(chunk[0], 0, {
        colSpan: leftSpan,
        rowSpan: 2,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: 220,
        headlinePosition: templateId === 'template-06' ? 'top' : 'below-image',
        headlineScale: 'xl',
        includeBullets: true,
        slotStyle: templateId === 'template-06' ? 'framed-teal' : 'default',
      }),
      createSlotFromArticle(chunk[1], 1, {
        colSpan: rightSpan,
        rowSpan: 2,
        role: 'sublead',
        imagePosition: 'top',
        imageHeightPx: 140,
        headlinePosition: 'top',
        headlineScale: 'lg',
        includeBullets: true,
        slotStyle: templateId === 'template-03' || templateId === 'template-04' ? 'analysis-box' : templateId === 'template-06' ? 'framed-gold' : 'default',
      }),
    ];
  }

  // Template 02: Ref 1 - Protidin Broadsheet (3-col photo lead + quote/bullets, 1-col mid, 2-col right inset, 3 bottom stories)
  if (templateId === 'template-02') {
    const leadCols = isLand ? 4 : 3;
    const midCols = isLand ? 2 : 1;
    const rightCols = totalCols - leadCols - midCols;
    const slots: PageArticleSlot[] = [
      createSlotFromArticle(chunk[0], 0, {
        colSpan: leadCols,
        rowSpan: 2,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: isFrontPage ? 205 : 185,
        headlinePosition: 'below-image',
        headlineScale: 'xl',
        includeBullets: true,
        continuationText: isFrontPage ? 'বিস্তারিত ভেতরের পাতায়' : '',
      }),
      createSlotFromArticle(chunk[1], 1, {
        colSpan: midCols,
        rowSpan: 2,
        role: 'sidebar',
        imagePosition: 'none',
        imageHeightPx: 80,
        headlinePosition: 'top',
        headlineScale: 'md',
        includeBullets: false,
      }),
      createSlotFromArticle(chunk[2], 2, {
        colSpan: rightCols,
        rowSpan: 2,
        role: 'sublead',
        imagePosition: 'top',
        imageHeightPx: 120,
        headlinePosition: 'top',
        headlineScale: 'lg',
        includeBullets: true,
      }),
    ];
    const rem = chunk.slice(3);
    if (rem.length === 1) {
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: totalCols,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 125,
          headlinePosition: 'top',
          headlineScale: 'lg',
          includeBullets: true,
        })
      );
    } else if (rem.length === 2) {
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: Math.floor(totalCols / 2),
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 115,
          headlinePosition: 'below-image',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[1], 4, {
          colSpan: Math.ceil(totalCols / 2),
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'right',
          imageHeightPx: 115,
          headlinePosition: 'top',
          headlineScale: 'md',
          includeBullets: true,
        })
      );
    } else if (rem.length >= 3) {
      const s1 = isLand ? 3 : 2;
      const s3 = totalCols - s1 * 2;
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: s1,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 95,
          headlinePosition: 'below-image',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[1], 4, {
          colSpan: s1,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 95,
          headlinePosition: 'top',
          headlineScale: 'md',
          includeBullets: true,
        }),
        createSlotFromArticle(rem[2], 5, {
          colSpan: s3,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'none',
          imageHeightPx: 90,
          headlinePosition: 'top',
          headlineScale: 'md',
          includeBullets: true,
        })
      );
    }
    return slots;
  }

  // Template 03: Ref 2 - Classical Ink Broadsheet (1-col left wing + 4-col center photo lead + 1-col right wing + lower split)
  if (templateId === 'template-03') {
    const leftWing = 1;
    const rightWing = isLand ? 2 : 1;
    const centerSpan = totalCols - leftWing - rightWing; // 4 in portrait, 5 in landscape
    const slots: PageArticleSlot[] = [
      createSlotFromArticle(chunk[1] || chunk[0], 1, {
        colSpan: leftWing,
        rowSpan: 2,
        role: 'sidebar',
        imagePosition: 'top',
        imageHeightPx: 85,
        headlinePosition: 'top',
        headlineScale: 'md',
      }),
      createSlotFromArticle(chunk[0], 0, {
        colSpan: centerSpan,
        rowSpan: 2,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: isFrontPage ? 210 : 185,
        headlinePosition: 'below-image',
        headlineScale: 'xl',
      }),
      createSlotFromArticle(chunk[2], 2, {
        colSpan: rightWing,
        rowSpan: 2,
        role: 'sidebar',
        imagePosition: 'none',
        imageHeightPx: 85,
        headlinePosition: 'top',
        headlineScale: 'md',
      }),
    ];
    const rem = chunk.slice(3);
    if (rem.length === 1) {
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: totalCols,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 115,
          headlinePosition: 'top',
          headlineScale: 'lg',
        })
      );
    } else if (rem.length === 2) {
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: isLand ? 5 : 4,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'right',
          imageHeightPx: 110,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[1], 4, {
          colSpan: isLand ? 3 : 2,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'top',
          imageHeightPx: 90,
          headlinePosition: 'top',
          headlineScale: 'md',
        })
      );
    } else if (rem.length >= 3) {
      const s1 = isLand ? 3 : 2;
      slots.push(
        createSlotFromArticle(rem[0], 3, {
          colSpan: s1,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 95,
          headlinePosition: 'top',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[1], 4, {
          colSpan: s1,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'left',
          imageHeightPx: 95,
          headlinePosition: 'top',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[2], 5, {
          colSpan: totalCols - s1 * 2,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'right',
          imageHeightPx: 95,
          headlinePosition: 'top',
          headlineScale: 'md',
        })
      );
    }
    return slots;
  }

  // Template 04: Ref 3 - Panoramic Banner Broadsheet (5-col top photo showcase + 1-col analysis + 1-col boxed + 3-col mid + 2-col right)
  if (templateId === 'template-04') {
    const topBannerCols = totalCols - (isLand ? 2 : 1);
    const analysisCols = totalCols - topBannerCols;
    const slots: PageArticleSlot[] = [
      createSlotFromArticle(chunk[0], 0, {
        colSpan: topBannerCols,
        rowSpan: 1,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: isFrontPage ? 200 : 175,
        headlinePosition: 'below-image',
        headlineScale: 'xl',
      }),
      createSlotFromArticle(chunk[1], 1, {
        colSpan: analysisCols,
        rowSpan: 1,
        role: 'sidebar',
        imagePosition: 'none',
        imageHeightPx: 80,
        headlinePosition: 'top',
        headlineScale: 'md',
        slotStyle: 'analysis-box',
      }),
    ];
    const rem = chunk.slice(2);
    if (rem.length === 1) {
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: totalCols,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 120,
          headlinePosition: 'top',
          headlineScale: 'lg',
        })
      );
    } else if (rem.length === 2) {
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: isLand ? 5 : 4,
          rowSpan: 1,
          role: 'sublead',
          imagePosition: 'right',
          imageHeightPx: 120,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[1], 3, {
          colSpan: isLand ? 3 : 2,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 95,
          headlinePosition: 'top',
          headlineScale: 'md',
          slotStyle: 'editorial-box',
        })
      );
    } else if (rem.length === 3) {
      const leftBox = isLand ? 2 : 1;
      const midBanner = isLand ? 4 : 3;
      const rightCol = totalCols - leftBox - midBanner;
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: leftBox,
          rowSpan: 1,
          role: 'sidebar',
          imagePosition: 'none',
          imageHeightPx: 80,
          headlinePosition: 'top',
          headlineScale: 'md',
          slotStyle: 'editorial-box',
        }),
        createSlotFromArticle(rem[1], 3, {
          colSpan: midBanner,
          rowSpan: 1,
          role: 'sublead',
          imagePosition: 'top',
          imageHeightPx: 125,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[2], 4, {
          colSpan: rightCol,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'right',
          imageHeightPx: 100,
          headlinePosition: 'top',
          headlineScale: 'md',
        })
      );
    } else if (rem.length >= 4) {
      const leftBox = isLand ? 2 : 1;
      const midBanner = isLand ? 4 : 3;
      const rightCol = totalCols - leftBox - midBanner;
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: leftBox,
          rowSpan: 2,
          role: 'sidebar',
          imagePosition: 'none',
          imageHeightPx: 80,
          headlinePosition: 'top',
          headlineScale: 'md',
          slotStyle: 'editorial-box',
        }),
        createSlotFromArticle(rem[1], 3, {
          colSpan: midBanner,
          rowSpan: 1,
          role: 'sublead',
          imagePosition: 'top',
          imageHeightPx: 120,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[2], 4, {
          colSpan: rightCol,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'none',
          imageHeightPx: 85,
          headlinePosition: 'top',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[3], 5, {
          colSpan: midBanner + rightCol,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 105,
          headlinePosition: 'top',
          headlineScale: 'md',
        })
      );
    }
    return slots;
  }

  // Template 05: Ref 4 - Metropolitan Lead Broadsheet (4-col top photo + 2-col stacked lead + 1/3/2 mid + 6-col bottom banner)
  if (templateId === 'template-05') {
    const topLeft = isLand ? 5 : 4;
    const topRight = totalCols - topLeft;
    const slots: PageArticleSlot[] = [
      createSlotFromArticle(chunk[0], 0, {
        colSpan: topLeft,
        rowSpan: 1,
        role: 'lead',
        imagePosition: 'top',
        imageHeightPx: isFrontPage ? 195 : 175,
        headlinePosition: 'below-image',
        headlineScale: 'xl',
      }),
      createSlotFromArticle(chunk[1], 1, {
        colSpan: topRight,
        rowSpan: 1,
        role: 'sublead',
        imagePosition: 'none',
        imageHeightPx: 90,
        headlinePosition: 'top',
        headlineScale: 'lg',
        includeBullets: true,
      }),
    ];
    const rem = chunk.slice(2);
    if (rem.length === 1) {
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: totalCols,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 115,
          headlinePosition: 'top',
          headlineScale: 'lg',
        })
      );
    } else if (rem.length === 2) {
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: isLand ? 5 : 4,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 115,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[1], 3, {
          colSpan: isLand ? 3 : 2,
          rowSpan: 1,
          role: 'sidebar',
          imagePosition: 'none',
          imageHeightPx: 90,
          headlinePosition: 'top',
          headlineScale: 'md',
          slotStyle: 'analysis-box',
        })
      );
    } else if (rem.length >= 3) {
      const m1 = isLand ? 2 : 1;
      const m2 = isLand ? 4 : 3;
      const m3 = totalCols - m1 - m2;
      slots.push(
        createSlotFromArticle(rem[0], 2, {
          colSpan: m1,
          rowSpan: 1,
          role: 'sidebar',
          imagePosition: 'none',
          imageHeightPx: 80,
          headlinePosition: 'top',
          headlineScale: 'md',
        }),
        createSlotFromArticle(rem[1], 3, {
          colSpan: m2,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'top',
          imageHeightPx: 120,
          headlinePosition: 'top',
          headlineScale: 'lg',
        }),
        createSlotFromArticle(rem[2], 4, {
          colSpan: m3,
          rowSpan: 1,
          role: 'secondary',
          imagePosition: 'none',
          imageHeightPx: 85,
          headlinePosition: 'top',
          headlineScale: 'md',
          slotStyle: 'analysis-box',
        })
      );
      if (rem[3]) {
        slots.push(
          createSlotFromArticle(rem[3], 5, {
            colSpan: totalCols,
            rowSpan: 1,
            role: 'bottom-anchor',
            imagePosition: 'left',
            imageHeightPx: 95,
            headlinePosition: 'top',
            headlineScale: 'lg',
          })
        );
      }
    }
    return slots;
  }

  // Template 06: Ref 5 - Editorial Color-Framed Daily
  const c1 = 1;
  const c2 = isLand ? 3 : 2;
  const c3 = isLand ? 2 : 1;
  const c4 = totalCols - c1 - c2 - c3;
  const slots: PageArticleSlot[] = [
    createSlotFromArticle(chunk[1] || chunk[0], 1, {
      colSpan: c1,
      rowSpan: 1,
      role: 'sidebar',
      imagePosition: 'none',
      imageHeightPx: 80,
      headlinePosition: 'top',
      headlineScale: 'md',
    }),
    createSlotFromArticle(chunk[2] || chunk[0], 2, {
      colSpan: c2,
      rowSpan: 1,
      role: 'secondary',
      imagePosition: 'top',
      imageHeightPx: 105,
      headlinePosition: 'below-image',
      headlineScale: 'md',
      slotStyle: 'editorial-box',
    }),
    createSlotFromArticle(chunk[3] || chunk[1] || chunk[0], 3, {
      colSpan: c3,
      rowSpan: 1,
      role: 'brief',
      imagePosition: 'none',
      imageHeightPx: 80,
      headlinePosition: 'top',
      headlineScale: 'sm',
      slotStyle: 'framed-gold',
    }),
    createSlotFromArticle(chunk[4] || chunk[2] || chunk[0], 4, {
      colSpan: c4,
      rowSpan: 1,
      role: 'sublead',
      imagePosition: 'right',
      imageHeightPx: 95,
      headlinePosition: 'top',
      headlineScale: 'md',
      includeBullets: true,
      slotStyle: 'framed-crimson',
    }),
    // Middle dominant wide headline story (Main Lead!)
    createSlotFromArticle(chunk[0], 0, {
      colSpan: isLand ? 6 : 4,
      rowSpan: 1,
      role: 'lead',
      imagePosition: 'right',
      imageHeightPx: 145,
      headlinePosition: 'top',
      headlineScale: 'xl',
      includeBullets: true,
      slotStyle: 'framed-teal',
    }),
  ];

  const midRightSpan = totalCols - (isLand ? 6 : 4);
  if (chunk[5]) {
    slots.push(
      createSlotFromArticle(chunk[5], 5, {
        colSpan: midRightSpan,
        rowSpan: 1,
        role: 'secondary',
        imagePosition: 'top',
        imageHeightPx: 100,
        headlinePosition: 'top',
        headlineScale: 'md',
        slotStyle: 'framed-gold',
      })
    );
    if (chunk[6]) {
      slots.push(
        createSlotFromArticle(chunk[6], 6, {
          colSpan: totalCols,
          rowSpan: 1,
          role: 'bottom-anchor',
          imagePosition: 'left',
          imageHeightPx: 105,
          headlinePosition: 'top',
          headlineScale: 'lg',
          includeBullets: true,
          slotStyle: 'framed-sky',
        })
      );
    }
  } else {
    // Fill mid-right cleanly when <= 5 articles on page
    slots.push(
      createSlotFromArticle(chunk[chunk.length - 1], 5, {
        colSpan: midRightSpan,
        rowSpan: 1,
        role: 'bottom-anchor',
        imagePosition: 'top',
        imageHeightPx: 95,
        headlinePosition: 'top',
        headlineScale: 'md',
        slotStyle: 'framed-sky',
      })
    );
  }
  return slots;
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
  templateId?: NewspaperTemplateId;
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
    templateId = 'template-01',
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
      templateId,
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
  const maxArticlesPerPage =
    templateId === 'template-06'
      ? orientation === 'landscape'
        ? 7
        : 6
      : orientation === 'landscape'
      ? 7
      : 6;

  const pages: NewspaperPage[] = [];
  let cursor = 0;
  let pageNumber = 1;

  while (cursor < ordered.length) {
    const isFrontPage = pageNumber === 1;
    const chunk = ordered.slice(cursor, cursor + maxArticlesPerPage);
    cursor += chunk.length;

    let slots: PageArticleSlot[] = [];

    if (templateId !== 'template-01') {
      slots = buildSlotsForTemplatePage(templateId, chunk, totalCols, orientation, isFrontPage);
    } else if (chunk.length === 1) {
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
    templateId,
    totalPages: pages.length,
    published: true,
    pages,
    ads: existingAds && existingAds.length > 0 ? existingAds : DEFAULT_ADS,
  };
}
