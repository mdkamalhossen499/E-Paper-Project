import React from 'react';
import {
  BrandingSettings,
  NewspaperPage,
  NewspaperTemplateId,
} from '../../types/epaper';
import { formatBengaliNewspaperDate, toBengaliDigits } from '../../utils/dhakaTime';
import { FixedLogoBox } from './NewspaperMasthead';

interface TemplateMastheadProps {
  templateId: NewspaperTemplateId;
  branding: BrandingSettings;
  editionDate: string;
  page: NewspaperPage;
  totalPages: number;
  pages?: NewspaperPage[];
}

export const TemplateMastheadRouter: React.FC<TemplateMastheadProps> = ({
  templateId,
  branding,
  editionDate,
  page,
  totalPages,
  pages = [],
}) => {
  const { weekdayBn, gregorianBn, banglaDateBn, hijriDateBn } =
    formatBengaliNewspaperDate(editionDate);

  // Templates 03, 04, 05: Classical Double-Rule Broadsheet Mastheads (inspired by Refs 2, 3, 4)
  if (templateId === 'template-03' || templateId === 'template-04' || templateId === 'template-05') {
    if (!page.isFrontPage) {
      return (
        <header className="w-full pb-1 mb-2 border-b-2 border-double border-stone-900">
          <div className="flex items-center justify-between gap-4 text-[10px] font-bn-sans">
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-1.5 py-0.5 bg-stone-900 text-white font-bold">
                পৃষ্ঠা {toBengaliDigits(page.pageNumber)}
              </span>
              <FixedLogoBox branding={branding} variant="inner" />
              <span className="font-bn-serif font-extrabold text-[13px] text-stone-950">
                {branding.bengaliNameMain}
              </span>
            </div>
            <div className="font-bn-serif font-bold text-[12px] tracking-wide uppercase text-stone-800">
              {page.sectionTitle}
            </div>
            <div className="text-right text-stone-700 shrink-0">
              {weekdayBn}, {gregorianBn} · {banglaDateBn}
            </div>
          </div>
        </header>
      );
    }

    const editionBadgeLabel =
      templateId === 'template-05'
        ? 'লেট এডিশন'
        : templateId === 'template-04'
        ? 'জাতীয় সংস্করণ'
        : 'ঢাকা সংস্করণ';

    return (
      <header className="w-full mb-2">
        <div className="flex items-stretch justify-between gap-3 pb-1.5">
          {/* Left Ear Box + Fixed Logo */}
          <div className="w-[162px] shrink-0 flex items-center gap-2">
            <FixedLogoBox branding={branding} variant="masthead" />
            <div className="flex-1 border border-stone-800 px-1.5 py-1 text-center text-[8.5px] leading-tight font-bn-serif italic text-stone-800">
              “{branding.tagline || 'সত্য ও ন্যায়ের পথে প্রতিদিন'}”
            </div>
          </div>

          {/* Center Authoritative Broadsheet Title */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-2">
            <h1 className="text-[40px] leading-[1.0] font-black font-bn-serif text-stone-950 tracking-tight truncate max-w-full">
              {branding.bengaliNamePrefix ? `${branding.bengaliNamePrefix} ` : ''}
              {branding.bengaliNameMain}
            </h1>
            <div className="text-[10px] font-admin-display font-bold tracking-[0.26em] uppercase text-stone-700 mt-0.5">
              {branding.englishName}
            </div>
          </div>

          {/* Right Ear Box (Weather / Edition) */}
          <div className="w-[152px] shrink-0 border-l border-stone-300 pl-2 flex flex-col justify-between text-right text-[8.5px] font-bn-sans text-stone-700 leading-tight">
            <div className="font-bold text-stone-950 uppercase tracking-wide">
              {editionBadgeLabel}
            </div>
            <div>{branding.editorName}</div>
            <div className="text-[8px] text-stone-500">
              আবহাওয়া: ঢাকা ও সারাদেশ · পরিষ্কার আকাশ
            </div>
          </div>
        </div>

        {/* Classic Double-Hairline Metadata Rule */}
        <div className="border-y-2 border-double border-stone-900 py-0.5 px-1 flex items-center justify-between text-[9.5px] font-bn-sans text-stone-800">
          <span className="font-medium">{branding.volumeText}</span>
          <span className="font-bold text-stone-950">
            ঢাকা · {weekdayBn}, {gregorianBn} · {banglaDateBn} · {hijriDateBn}
          </span>
          <span className="font-medium">{branding.priceText}</span>
        </div>
      </header>
    );
  }

  // Templates 02 & 06: Bangladeshi Broadsheet Mastheads (inspired by Refs 1 & 5)
  const prefixColor = templateId === 'template-02' ? '#0284c7' : branding.accentColor;
  const barBg =
    templateId === 'template-02'
      ? 'linear-gradient(90deg, #b91c1c 0%, #991b1b 50%, #dc2626 100%)'
      : `linear-gradient(90deg, ${branding.primaryColor} 0%, #0f172a 50%, ${branding.accentColor} 100%)`;

  if (!page.isFrontPage) {
    return (
      <header className="w-full pb-1.5 mb-2 border-b-2 border-stone-900">
        <div className="flex items-center justify-between gap-4 pb-1 border-b border-stone-300">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold text-white font-bn-sans"
              style={{ backgroundColor: prefixColor }}
            >
              পৃষ্ঠা {toBengaliDigits(page.pageNumber)}
            </span>
            <FixedLogoBox branding={branding} variant="inner" />
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold font-bn-serif text-stone-900">
                {branding.bengaliNameMain}
              </div>
              <div className="text-[8.5px] font-semibold tracking-wider text-stone-500 uppercase">
                {branding.englishName}
              </div>
            </div>
          </div>

          <div className="text-center px-3 py-0.5 border-x border-stone-300">
            <span className="text-[13px] font-bold font-bn-serif text-stone-800">
              {page.sectionTitle}
            </span>
          </div>

          <div className="text-right text-[9.5px] text-stone-600 font-bn-sans leading-tight shrink-0">
            <div className="font-semibold text-stone-900">
              {weekdayBn}, {gregorianBn}
            </div>
            <div>{banglaDateBn}</div>
          </div>
        </div>
      </header>
    );
  }

  const promoItems = [
    {
      label: pages[1]?.sectionTitle || 'সম্পাদকীয়',
      sub: pages[1]?.slots[0]?.customTitle?.slice(0, 32) || 'দিনের বিশেষ বিশ্লেষণ ও কলাম',
      pageNum: pages[1] ? pages[1].pageNumber : 2,
    },
    {
      label: 'অর্থনীতি ও বাণিজ্য',
      sub: 'বাজার পরিস্থিতি ও শিল্প প্রতিবেদন',
      pageNum: Math.min(totalPages, 2),
    },
    {
      label: 'রাজনীতি ও নির্বাচন',
      sub: 'মাঠপর্যায়ের বিশেষ প্রতিবেদন',
      pageNum: Math.min(totalPages, 3),
    },
    {
      label: 'খেলাধুলা ও বিনোদন',
      sub: 'মাঠের সংবাদ ও সাংস্কৃতিক আয়োজন',
      pageNum: totalPages,
    },
  ];

  return (
    <header className="w-full mb-1.5">
      <div className="flex items-stretch justify-between gap-2.5 pb-1.5">
        <div className="w-[132px] shrink-0 border-r border-stone-300 pr-2 flex flex-col justify-between text-[9.5px] leading-[1.35] font-bn-sans text-stone-700">
          <div>
            <div className="text-[11px] font-bold text-stone-950">{weekdayBn}</div>
            <div>{gregorianBn}</div>
            <div>{banglaDateBn}</div>
            <div>{hijriDateBn}</div>
          </div>
          <div className="pt-1 border-t border-stone-200 text-[9px] text-stone-600">
            <div>{branding.volumeText}</div>
            <div className="font-semibold text-stone-800">{branding.priceText}</div>
          </div>
        </div>

        <div className="flex items-center shrink-0">
          <FixedLogoBox branding={branding} variant="masthead" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-2">
          {branding.bengaliNamePrefix && (
            <div
              className="text-[14px] font-bold font-bn-sans tracking-[0.24em] leading-none mb-0.5"
              style={{ color: prefixColor }}
            >
              {branding.bengaliNamePrefix}
            </div>
          )}
          <h1 className="text-[42px] leading-[1.02] font-black font-bn-serif text-stone-950 tracking-tight truncate max-w-full">
            {branding.bengaliNameMain}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-0.5 text-[9.5px] font-semibold text-stone-600">
            <span className="uppercase tracking-[0.18em] font-admin-display text-stone-800">
              {branding.englishName}
            </span>
            {branding.tagline && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bn-sans">{branding.tagline}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-[138px] shrink-0 border-l border-stone-300 pl-2 flex flex-col justify-between text-right font-bn-sans">
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: prefixColor }}
            >
              {templateId === 'template-06' ? 'বিশেষ সংস্করণ' : 'প্রথম সংস্করণ'}
            </div>
            <div className="text-[9.5px] font-semibold text-stone-800 mt-0.5 truncate">
              {branding.editorName}
            </div>
            <div className="text-[8.5px] text-stone-500 truncate">
              {branding.publisherName}
            </div>
          </div>
          <div className="mt-1 px-1.5 py-1 border border-stone-300 bg-stone-50 text-center">
            <div className="text-[9px] font-bold text-stone-900 leading-tight">
              {templateId === 'template-06' ? 'রঙিন সম্পাদকীয় সংস্করণ' : 'দৈনিক মুদ্রিত সংস্করণ'}
            </div>
            <div className="text-[8px] text-stone-600 leading-tight">
              {branding.websiteUrl}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-y border-stone-300 divide-x divide-stone-300 py-1 bg-stone-50/70">
        {promoItems.map((item, idx) => (
          <div key={idx} className="px-2 flex items-center justify-between gap-1.5 min-w-0">
            <div className="min-w-0">
              <div className="text-[9px] font-bold font-bn-sans truncate" style={{ color: prefixColor }}>
                {item.label}
              </div>
              <div className="text-[8.5px] text-stone-700 font-bn-serif truncate leading-tight">
                {item.sub}
              </div>
            </div>
            <span className="text-[16px] font-black font-bn-serif text-stone-700 shrink-0 leading-none">
              {toBengaliDigits(item.pageNum)}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-1 px-3 py-0.5 flex items-center justify-between text-[9px] font-medium text-white rounded-sm"
        style={{ background: barBg }}
      >
        <span className="truncate">{branding.websiteUrl}</span>
        <span className="truncate">Facebook: {branding.facebookHandle}</span>
        <span className="truncate">YouTube: {branding.youtubeHandle}</span>
        <span className="truncate">{branding.contactEmail}</span>
      </div>
    </header>
  );
};
