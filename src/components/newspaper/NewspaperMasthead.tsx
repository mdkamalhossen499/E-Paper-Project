import React from 'react';
import { BrandingSettings, NewspaperPage } from '../../types/epaper';
import { formatBengaliNewspaperDate, toBengaliDigits } from '../../utils/dhakaTime';

interface NewspaperMastheadProps {
  branding: BrandingSettings;
  editionDate: string;
  page: NewspaperPage;
  totalPages: number;
  pages?: NewspaperPage[];
}

export const FixedLogoBox: React.FC<{
  branding: BrandingSettings;
  variant?: 'masthead' | 'inner';
}> = ({ branding, variant = 'masthead' }) => {
  const isMasthead = variant === 'masthead';
  const boxClass = isMasthead
    ? 'w-[104px] h-[76px] shrink-0 border border-stone-300 bg-white p-1 flex items-center justify-center overflow-hidden'
    : 'w-[42px] h-[30px] shrink-0 border border-stone-300 bg-white p-0.5 flex items-center justify-center overflow-hidden';

  if (branding.logoDataUrl) {
    return (
      <div className={boxClass}>
        <img
          src={branding.logoDataUrl}
          alt={branding.englishName}
          className="w-full h-full object-contain block"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={boxClass}
      style={{
        background: `linear-gradient(135deg, ${branding.primaryColor} 0%, #991b1b 55%, #065f46 55%, ${branding.accentColor} 100%)`,
      }}
    >
      <div className="w-full h-full bg-white/95 flex flex-col items-center justify-center px-1 text-center border border-stone-200">
        <svg
          viewBox="0 0 64 40"
          className={isMasthead ? 'w-11 h-7' : 'w-6 h-4'}
          aria-hidden="true"
        >
          <path
            d="M4 30 Q18 18 32 26 T60 22"
            fill="none"
            stroke={branding.accentColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="15" r="8" fill={branding.primaryColor} />
          <path
            d="M12 15 L20 15 M44 15 L52 15 M32 2 L32 5 M21 6 L24 9 M43 6 L40 9"
            stroke={branding.primaryColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        {isMasthead && (
          <span
            className="text-[8px] font-bold tracking-wider uppercase leading-none mt-0.5 truncate max-w-full"
            style={{ color: branding.primaryColor }}
          >
            {branding.englishName.slice(0, 14)}
          </span>
        )}
      </div>
    </div>
  );
};

export const NewspaperMasthead: React.FC<NewspaperMastheadProps> = ({
  branding,
  editionDate,
  page,
  totalPages,
  pages = [],
}) => {
  const { weekdayBn, gregorianBn, banglaDateBn, hijriDateBn } =
    formatBengaliNewspaperDate(editionDate);

  if (!page.isFrontPage) {
    return (
      <header className="w-full pb-1.5 mb-2 border-b-2 border-stone-900">
        <div className="flex items-center justify-between gap-4 pb-1 border-b border-stone-300">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold text-white font-bn-sans"
              style={{ backgroundColor: branding.primaryColor }}
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
      label: pages[1]?.sectionTitle || 'জাতীয় ও রাজনীতি',
      sub: pages[1]?.slots[0]?.customTitle?.slice(0, 34) || 'দিনের প্রধান জাতীয় ও রাজনৈতিক সংবাদ',
      pageNum: pages[1] ? pages[1].pageNumber : 2,
    },
    {
      label: pages[2]?.sectionTitle || 'দেশজুড়ে ও অর্থনীতি',
      sub: pages[2]?.slots[0]?.customTitle?.slice(0, 34) || 'বাণিজ্য, বন্দর ও আঞ্চলিক উন্নয়ন প্রতিবেদন',
      pageNum: pages[2] ? pages[2].pageNumber : 3,
    },
    {
      label: 'তথ্য ও প্রযুক্তি',
      sub: 'ডিজিটাল বাংলাদেশ ও তরুণ উদ্যোক্তা',
      pageNum: Math.min(totalPages, 2),
    },
    {
      label: 'খেলাধুলা ও বিনোদন',
      sub: 'মাঠের লড়াই ও সাংস্কৃতিক আয়োজন',
      pageNum: totalPages,
    },
  ];

  return (
    <header className="w-full mb-1.5">
      {/* Main Fixed Masthead Band */}
      <div className="flex items-stretch justify-between gap-2.5 pb-1.5">
        {/* Left Date & Issue Column */}
        <div className="w-[132px] shrink-0 border-r border-stone-300 pr-2 flex flex-col justify-between text-[9.5px] leading-[1.35] font-bn-sans text-stone-700">
          <div>
            <div className="text-[11px] font-bold text-stone-950">{weekdayBn}</div>
            <div>{banglaDateBn}</div>
            <div>{hijriDateBn}</div>
            <div className="font-semibold text-stone-900">{gregorianBn}</div>
          </div>
          <div className="pt-1 border-t border-stone-200 text-[9px] text-stone-600">
            <div>{branding.volumeText}</div>
            <div className="font-semibold text-stone-800">{branding.priceText}</div>
          </div>
        </div>

        {/* Fixed Official Logo Container */}
        <div className="flex items-center shrink-0">
          <FixedLogoBox branding={branding} variant="masthead" />
        </div>

        {/* Center Giant Masthead Title */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-2">
          {branding.bengaliNamePrefix && (
            <div
              className="text-[13px] font-bold font-bn-sans tracking-[0.22em] leading-none mb-0.5"
              style={{ color: branding.accentColor }}
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

        {/* Right Edition & Special Ear Box */}
        <div className="w-[138px] shrink-0 border-l border-stone-300 pl-2 flex flex-col justify-between text-right font-bn-sans">
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: branding.primaryColor }}
            >
              ঢাকা সংস্করণ
            </div>
            <div className="text-[9.5px] font-semibold text-stone-800 mt-0.5 truncate">
              {branding.editorName}
            </div>
            <div className="text-[8.5px] text-stone-500 truncate">
              {branding.publisherName}
            </div>
          </div>
          <div
            className="mt-1 px-1.5 py-1 border text-center"
            style={{
              borderColor: branding.primaryColor,
              backgroundColor: '#fef2f2',
            }}
          >
            <div
              className="text-[9px] font-bold leading-tight"
              style={{ color: branding.primaryColor }}
            >
              সকাল ৮টা – সকাল ৮টা
            </div>
            <div className="text-[8px] text-stone-700 leading-tight">
              দৈনিক ডিজিটাল ই-পেপার
            </div>
          </div>
        </div>
      </div>

      {/* Reference-style 4-column Page Promo Strip */}
      <div className="grid grid-cols-4 border-y border-stone-300 divide-x divide-stone-300 py-1 bg-stone-50/70">
        {promoItems.map((item, idx) => (
          <div key={idx} className="px-2 flex items-center justify-between gap-1.5 min-w-0">
            <div className="min-w-0">
              <div
                className="text-[9px] font-bold font-bn-sans truncate"
                style={{ color: branding.primaryColor }}
              >
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

      {/* Reference-style Crimson/Dark Contact Ribbon */}
      <div
        className="mt-1 px-3 py-0.5 flex items-center justify-between text-[9px] font-medium text-white rounded-sm"
        style={{
          background: `linear-gradient(90deg, ${branding.primaryColor} 0%, #1e293b 50%, ${branding.primaryColor} 100%)`,
        }}
      >
        <span className="truncate">{branding.websiteUrl}</span>
        <span className="truncate">Facebook: {branding.facebookHandle}</span>
        <span className="truncate">YouTube: {branding.youtubeHandle}</span>
        <span className="truncate">{branding.contactEmail}</span>
      </div>
    </header>
  );
};
