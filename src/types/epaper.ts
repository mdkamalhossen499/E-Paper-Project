export type PaperFormat = 'A3' | 'A4';
export type PaperOrientation = 'portrait' | 'landscape';
export type NewspaperTemplateId =
  | 'template-01'
  | 'template-02'
  | 'template-03'
  | 'template-04'
  | 'template-05'
  | 'template-06';

export interface NewspaperTemplateMeta {
  id: NewspaperTemplateId;
  code: string;
  name: string;
  bengaliName: string;
  subtitle: string;
  description: string;
  columnsSummary: string;
  mastheadStyle: string;
  accentColor: string;
}

export interface BrandingSettings {
  bengaliNamePrefix: string;
  bengaliNameMain: string;
  englishName: string;
  tagline: string;
  logoDataUrl: string;
  editorName: string;
  publisherName: string;
  officeAddress: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  facebookHandle: string;
  youtubeHandle: string;
  primaryColor: string;
  accentColor: string;
  paperBackground: string;
  priceText: string;
  volumeText: string;
  bloggerUrl: string;
  showAds: boolean;
  defaultFormat: PaperFormat;
  defaultOrientation: PaperOrientation;
  templateId?: NewspaperTemplateId;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  imageCaption: string;
  url: string;
  publishedAt: string;
  dhakaEditionDate: string; // YYYY-MM-DD based on 8AM-8AM Asia/Dhaka window
  category: string;
  author: string;
  source: 'blogger' | 'manual';
  ownerId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SlotRole =
  | 'lead'
  | 'sublead'
  | 'secondary'
  | 'sidebar'
  | 'bottom-anchor'
  | 'brief';

export type ImagePosition = 'top' | 'left' | 'right' | 'none';
export type HeadlinePosition = 'top' | 'below-image';
export type HeadlineScale = 'xl' | 'lg' | 'md' | 'sm';

export interface PageArticleSlot {
  slotId: string;
  articleId: string;
  colSpan: number; // grid columns occupied (out of 6 in portrait, 8 in landscape)
  rowSpan: number;
  role: SlotRole;
  showImage: boolean;
  imagePosition: ImagePosition;
  imageHeightPx: number;
  headlinePosition: HeadlinePosition;
  headlineScale: HeadlineScale;
  customTitle: string;
  customContent: string;
  customCaption: string;
  customAuthor: string;
  customCategory: string;
  bulletPoints: string[];
  continuationText: string;
  slotStyle?:
    | 'default'
    | 'framed-gold'
    | 'framed-crimson'
    | 'framed-sky'
    | 'framed-teal'
    | 'analysis-box'
    | 'editorial-box'
    | 'digest-row';
}

export interface NewspaperAd {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  phone: string;
  accentColor: string;
}

export interface NewspaperPage {
  pageNumber: number;
  sectionTitle: string;
  isFrontPage: boolean;
  slots: PageArticleSlot[];
  showAdsOnPage: boolean;
}

export interface NewspaperEdition {
  id: string;
  editionDate: string; // YYYY-MM-DD (Asia/Dhaka)
  editionNumber: number;
  title: string;
  format: PaperFormat;
  orientation: PaperOrientation;
  templateId?: NewspaperTemplateId;
  totalPages: number;
  published: boolean;
  pages: NewspaperPage[];
  ads: NewspaperAd[];
  authorId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AdminNavSection =
  | 'dashboard'
  | 'blogger'
  | 'all-news'
  | 'select-news'
  | 'templates'
  | 'designer'
  | 'flipbook'
  | 'pdf-print'
  | 'archive'
  | 'branding'
  | 'settings';

export const PAPER_MM: Record<
  PaperFormat,
  Record<PaperOrientation, { width: number; height: number }>
> = {
  A3: {
    portrait: { width: 297, height: 420 },
    landscape: { width: 420, height: 297 },
  },
  A4: {
    portrait: { width: 210, height: 297 },
    landscape: { width: 297, height: 210 },
  },
};

// Fixed canvas dimensions maintain identical proportions, masthead geometry,
// and logo container box across preview, flipbook, PDF, and print.
export function getCanvasDimensions(
  format: PaperFormat,
  orientation: PaperOrientation
): { width: number; height: number; columns: number } {
  const mm = PAPER_MM[format][orientation];
  if (orientation === 'portrait') {
    const width = format === 'A3' ? 920 : 860;
    const height = Math.round(width * (mm.height / mm.width));
    return { width, height, columns: 6 };
  }
  const height = format === 'A3' ? 920 : 860;
  const width = Math.round(height * (mm.width / mm.height));
  return { width, height, columns: 8 };
}
