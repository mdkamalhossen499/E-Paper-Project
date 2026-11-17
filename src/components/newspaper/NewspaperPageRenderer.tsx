import React from 'react';
import {
  BrandingSettings,
  getCanvasDimensions,
  NewsArticle,
  NewspaperAd,
  NewspaperPage,
  NewspaperTemplateId,
  PageArticleSlot,
  PaperFormat,
  PaperOrientation,
} from '../../types/epaper';
import { formatBengaliNewspaperDate, toBengaliDigits } from '../../utils/dhakaTime';
import { NewspaperMasthead } from './NewspaperMasthead';

interface NewspaperPageRendererProps {
  page: NewspaperPage;
  totalPages: number;
  allPages?: NewspaperPage[];
  editionDate: string;
  format: PaperFormat;
  orientation: PaperOrientation;
  templateId?: NewspaperTemplateId;
  branding: BrandingSettings;
  articlesMap: Record<string, NewsArticle>;
  ads: NewspaperAd[];
  editable?: boolean;
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string) => void;
  scale?: number;
  pageRef?: (el: HTMLDivElement | null) => void;
}

function getHeadlineSizeClass(scale: PageArticleSlot['headlineScale'], role: PageArticleSlot['role']): string {
  if (scale === 'xl' || role === 'lead') return 'text-[27px] leading-[1.12] font-black';
  if (scale === 'lg') return 'text-[18.5px] leading-[1.16] font-extrabold';
  if (scale === 'md') return 'text-[15px] leading-[1.18] font-bold';
  return 'text-[13px] leading-[1.2] font-bold';
}

function getBodyCharBudget(slot: PageArticleSlot, isFrontPage: boolean): number {
  const base = slot.colSpan * 270 * slot.rowSpan;
  const imgPenalty = slot.showImage ? Math.round(slot.imageHeightPx * 1.4) : 0;
  const frontPenalty = isFrontPage && slot.role === 'lead' ? 100 : 0;
  return Math.max(240, base - imgPenalty - frontPenalty);
}

const ArticleSlotCard: React.FC<{
  slot: PageArticleSlot;
  article?: NewsArticle;
  branding: BrandingSettings;
  templateId: NewspaperTemplateId;
  isFrontPage: boolean;
  editable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}> = ({ slot, article, branding, templateId, isFrontPage, editable, isSelected, onSelect }) => {
  const imageUrl = article?.imageUrl || '';
  const hasImage = slot.showImage && Boolean(imageUrl) && slot.imagePosition !== 'none';
  const isClassicInk =
    templateId === 'template-03' || templateId === 'template-04' || templateId === 'template-05';
  const slotStyle = templateId === 'template-01' ? 'default' : slot.slotStyle || 'default';

  const charBudget = getBodyCharBudget(slot, isFrontPage);
  const rawBody = (slot.customContent || '').trim();
  const displayBody =
    rawBody.length > charBudget
      ? `${rawBody.slice(0, charBudget).replace(/\s+\S*$/, '')}...`
      : rawBody;

  const textColumnsClass =
    slot.colSpan >= 4
      ? 'columns-3 gap-3'
      : slot.colSpan >= 2
      ? 'columns-2 gap-2.5'
      : 'columns-1';

  const headlineAlignClass =
    templateId === 'template-02' && slot.role === 'lead'
      ? 'text-center'
      : slotStyle === 'editorial-box' || slotStyle === 'framed-crimson'
      ? 'text-center'
      : '';

  const headlineEl = (
    <h2
      className={`newspaper-headline text-stone-950 ${headlineAlignClass} ${getHeadlineSizeClass(
        slot.headlineScale,
        slot.role
      )}`}
    >
      {slot.customTitle}
    </h2>
  );

  const metaEl = isClassicInk ? (
    <div className="flex items-center justify-between gap-2 my-1 pb-0.5 border-b border-stone-300 text-[8.5px] font-bn-serif italic text-stone-600">
      <span className="font-semibold text-stone-800 not-italic uppercase tracking-wider">
        {slot.customCategory || 'জাতীয়'}
      </span>
      <span className="truncate">{slot.customAuthor || 'নিজস্ব প্রতিবেদক'}</span>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2 my-1 pb-0.5 border-b border-stone-200 text-[9px] font-bn-sans">
      <div className="flex items-center gap-1 min-w-0">
        <span
          className="inline-block w-1.5 h-1.5 rotate-45 shrink-0"
          style={{
            backgroundColor:
              templateId === 'template-02' ? '#0284c7' : branding.accentColor,
          }}
        />
        <span
          className="font-bold truncate"
          style={{
            color: templateId === 'template-02' ? '#0284c7' : branding.accentColor,
          }}
        >
          {slot.customCategory || 'জাতীয়'}
        </span>
      </div>
      <span className="text-stone-600 font-medium truncate">
        {slot.customAuthor || 'নিজস্ব প্রতিবেদক'}
      </span>
    </div>
  );

  const imageBlock = hasImage ? (
    <figure
      className={
        slot.imagePosition === 'left'
          ? 'float-left mr-2.5 mb-1.5 w-[44%]'
          : slot.imagePosition === 'right'
          ? 'float-right ml-2.5 mb-1.5 w-[44%]'
          : 'w-full mb-1.5'
      }
    >
      <div
        className="w-full overflow-hidden border border-stone-300 bg-stone-100"
        style={{ height: `${slot.imageHeightPx}px` }}
      >
        <img
          src={imageUrl}
          alt={slot.customCaption || slot.customTitle}
          className="w-full h-full object-cover block"
          referrerPolicy="no-referrer"
        />
      </div>
      {(slot.customCaption || slot.role === 'lead') && (
        <figcaption className="mt-0.5 text-[8.5px] leading-[1.25] text-stone-600 font-bn-sans flex items-start justify-between gap-1">
          <span className="line-clamp-2">{slot.customCaption || slot.customTitle}</span>
          <span className="shrink-0 text-stone-500">। সংগৃহীত</span>
        </figcaption>
      )}
    </figure>
  ) : null;

  const bulletsBoxClass =
    templateId === 'template-02'
      ? 'mb-1.5 px-2 py-1.5 bg-amber-50/85 border border-amber-200 text-[9.5px] leading-[1.35] font-bn-sans text-stone-800 space-y-0.5 break-inside-avoid'
      : slotStyle === 'framed-teal'
      ? 'mb-1.5 px-2 py-1.5 bg-teal-50/80 border border-teal-200 text-[9.5px] leading-[1.35] font-bn-sans text-stone-800 space-y-0.5 break-inside-avoid'
      : 'mb-1.5 px-2 py-1 bg-stone-100/90 border border-stone-200 text-[9.5px] leading-[1.35] font-bn-sans text-stone-800 space-y-0.5 break-inside-avoid';

  const bulletsBlock =
    slot.bulletPoints && slot.bulletPoints.length > 0 ? (
      <div className={bulletsBoxClass}>
        {slot.bulletPoints.map((bp, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span
              className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: branding.primaryColor }}
            />
            <span>{bp}</span>
          </div>
        ))}
      </div>
    ) : null;

  const slotSurfaceClass =
    slotStyle === 'framed-gold'
      ? 'bg-amber-50/45 border-t-2 border-t-amber-500'
      : slotStyle === 'framed-crimson'
      ? 'bg-rose-50/35 border-t-2 border-t-red-700'
      : slotStyle === 'framed-sky'
      ? 'bg-sky-50/45 border-t-2 border-t-sky-700'
      : slotStyle === 'framed-teal'
      ? 'bg-white border-t-2 border-t-teal-700'
      : slotStyle === 'analysis-box'
      ? 'bg-stone-100/80 border-t-2 border-t-stone-900'
      : slotStyle === 'editorial-box'
      ? 'bg-white border border-stone-700'
      : '';

  const slotBannerBar =
    templateId === 'template-06' && slotStyle !== 'default' ? (
      <div
        className="mb-1 px-2 py-0.5 text-[8.5px] font-bold font-bn-sans text-white flex items-center justify-between"
        style={{
          backgroundColor:
            slotStyle === 'framed-gold'
              ? '#d97706'
              : slotStyle === 'framed-crimson'
              ? '#b91c1c'
              : slotStyle === 'framed-sky'
              ? '#0369a1'
              : slotStyle === 'framed-teal'
              ? '#0f766e'
              : '#1c1917',
        }}
      >
        <span>
          {slotStyle === 'editorial-box'
            ? 'সম্পাদকের ডেস্ক থেকে'
            : slot.customCategory || 'বিশেষ প্রতিবেদন'}
        </span>
        <span>●</span>
      </div>
    ) : templateId === 'template-04' && slotStyle === 'analysis-box' ? (
      <div className="mb-1 text-[8px] font-bold uppercase tracking-widest text-stone-700 border-b border-stone-400 pb-0.5">
        বিশেষ বিশ্লেষণ
      </div>
    ) : null;

  return (
    <article
      onClick={editable ? onSelect : undefined}
      style={{
        gridColumn: `span ${slot.colSpan} / span ${slot.colSpan}`,
        gridRow: `span ${slot.rowSpan} / span ${slot.rowSpan}`,
      }}
      className={`relative p-2 border-r border-b border-stone-300 flex flex-col overflow-hidden transition-shadow ${slotSurfaceClass} ${
        editable
          ? isSelected
            ? 'ring-2 ring-inset ring-blue-600 bg-blue-50/30 cursor-pointer'
            : 'hover:bg-amber-50/40 cursor-pointer'
          : ''
      }`}
    >
      {slotBannerBar}
      {editable && isSelected && (
        <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 text-[9px] font-admin-display font-semibold bg-blue-600 text-white rounded">
          Editing
        </span>
      )}

      {slot.headlinePosition === 'below-image' && slot.imagePosition === 'top' && hasImage ? (
        <>
          {imageBlock}
          <div className="mb-1">{headlineEl}</div>
          {metaEl}
        </>
      ) : (
        <>
          <div className="mb-1">{headlineEl}</div>
          {metaEl}
          {slot.imagePosition === 'top' && imageBlock}
        </>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className={`newspaper-body-text text-[10.8px] text-stone-800 ${textColumnsClass}`}
          style={{ columnRule: '1px solid #e2e8f0' }}
        >
          {slot.imagePosition !== 'top' && imageBlock}
          {bulletsBlock}
          {displayBody.split(/\n+/).map((para, idx) => (
            <p key={idx} className={idx > 0 ? 'mt-1.5 indent-3' : ''}>
              {para}
            </p>
          ))}
          {slot.continuationText && (
            <span
              className="inline-block ml-1.5 text-[9.5px] font-bold font-bn-sans"
              style={{ color: branding.primaryColor }}
            >
              ▸ {slot.continuationText}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const NewspaperPageRenderer: React.FC<NewspaperPageRendererProps> = ({
  page,
  totalPages,
  allPages = [],
  editionDate,
  format,
  orientation,
  templateId,
  branding,
  articlesMap,
  ads,
  editable = false,
  selectedSlotId = null,
  onSelectSlot,
  scale = 1,
  pageRef,
}) => {
  const activeTemplate: NewspaperTemplateId =
    templateId || branding.templateId || 'template-01';
  const { width, height, columns } = getCanvasDimensions(format, orientation);
  const { weekdayBn, gregorianBn } = formatBengaliNewspaperDate(editionDate);

  const gridColsClass = orientation === 'landscape' ? 'grid-cols-8' : 'grid-cols-6';
  const showAdsBar = page.showAdsOnPage && ads.length > 0;
  const isClassicInk =
    activeTemplate === 'template-03' ||
    activeTemplate === 'template-04' ||
    activeTemplate === 'template-05';

  return (
    <div
      style={{
        width: `${Math.round(width * scale)}px`,
        height: `${Math.round(height * scale)}px`,
      }}
      className="relative shrink-0"
    >
      <div
        ref={pageRef}
        className="newspaper-sheet print-page-break border border-stone-300 shadow-md flex flex-col"
        style={
          {
            width: `${width}px`,
            height: `${height}px`,
            padding: '16px 18px 12px 18px',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            '--paper-bg': branding.paperBackground || '#fdfcf8',
          } as React.CSSProperties
        }
      >
        {/* Masthead (Page 1 full broadsheet masthead; Page 2+ matching inner running header) */}
        <NewspaperMasthead
          branding={branding}
          editionDate={editionDate}
          page={page}
          totalPages={totalPages}
          pages={allPages}
          templateId={activeTemplate}
        />

        {/* Broadsheet Multi-Column Grid */}
        <main
          className={`flex-1 min-h-0 border-t border-l border-stone-300 grid ${gridColsClass} auto-rows-fr`}
        >
          {page.slots.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-center p-8 border-r border-b border-stone-300 text-stone-500 font-bn-sans"
              style={{ gridColumn: `span ${columns} / span ${columns}` }}
            >
              <p className="text-base font-semibold">এই পৃষ্ঠায় কোনো সংবাদ যুক্ত করা হয়নি</p>
              <p className="text-xs mt-1">
                বাম পাশের সংবাদ তালিকা থেকে এই পাতায় সংবাদ যোগ করুন।
              </p>
            </div>
          ) : (
            page.slots.map((slot) => (
              <ArticleSlotCard
                key={slot.slotId}
                slot={slot}
                article={articlesMap[slot.articleId]}
                branding={branding}
                templateId={activeTemplate}
                isFrontPage={page.isFrontPage}
                editable={editable}
                isSelected={selectedSlotId === slot.slotId}
                onSelect={() => onSelectSlot?.(slot.slotId)}
              />
            ))
          )}
        </main>

        {/* Classical 5-Column Bottom Index Digest Strip for Templates 03, 04, 05 */}
        {isClassicInk && page.slots.length > 0 && (
          <section className="mt-1.5 pt-1 border-t-2 border-stone-900 grid grid-cols-5 divide-x divide-stone-300 shrink-0">
            {Array.from({ length: 5 }).map((_, idx) => {
              const refSlot = page.slots[idx % page.slots.length];
              return (
                <div key={idx} className="px-1.5 min-w-0">
                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-stone-600 font-bn-sans">
                    {refSlot?.customCategory || 'সংবাদ সূচি'} · পৃষ্ঠা {toBengaliDigits(Math.min(totalPages, idx + 1))}
                  </div>
                  <div className="text-[9px] font-bold font-bn-serif text-stone-900 leading-tight line-clamp-1 mt-0.5">
                    {refSlot?.customTitle}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Traditional Small Newspaper Advertisements Strip */}
        {showAdsBar && (
          <section className="mt-1.5 pt-1 border-t border-stone-400 grid grid-cols-2 gap-2 shrink-0">
            {ads.slice(0, 2).map((ad) => (
              <div
                key={ad.id}
                className="border border-stone-400 bg-white px-2.5 py-1 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="px-1 py-0.2 text-[8px] font-bold text-white font-bn-sans uppercase"
                      style={{ backgroundColor: ad.accentColor || branding.primaryColor }}
                    >
                      {ad.badge}
                    </span>
                    <span className="text-[11px] font-extrabold font-bn-serif text-stone-950 truncate">
                      {ad.title}
                    </span>
                  </div>
                  <p className="text-[8.5px] text-stone-700 font-bn-sans truncate mt-0.5">
                    {ad.subtitle}
                  </p>
                </div>
                <div
                  className="text-[9.5px] font-bold font-bn-sans shrink-0 pl-2 border-l border-stone-300"
                  style={{ color: ad.accentColor || branding.accentColor }}
                >
                  {ad.phone}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Consistent Newspaper Footer on Every Page */}
        <footer className="mt-1.5 pt-1 border-t border-stone-400 flex items-center justify-between gap-4 text-[9px] font-bn-sans text-stone-600 shrink-0">
          <div className="truncate">
            <span className="font-bold text-stone-900">{branding.bengaliNameMain}</span>
            {branding.officeAddress && <span> · {branding.officeAddress}</span>}
          </div>
          <div className="font-bold text-stone-900 shrink-0">
            পৃষ্ঠা {toBengaliDigits(page.pageNumber)} / {toBengaliDigits(totalPages)}
          </div>
          <div className="truncate text-right">
            {branding.publisherName} · {weekdayBn}, {gregorianBn}
          </div>
        </footer>
      </div>
    </div>
  );
};
