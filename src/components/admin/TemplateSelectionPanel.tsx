import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Layers, Sparkles, X } from 'lucide-react';
import {
  BrandingSettings,
  NewsArticle,
  NewspaperTemplateId,
  NewspaperTemplateMeta,
} from '../../types/epaper';
import { NEWSPAPER_TEMPLATES } from '../../data/templates';
import { generateNewspaperEdition } from '../../utils/layoutEngine';
import { getCurrentDhakaEditionDate } from '../../utils/dhakaTime';
import { NewspaperPageRenderer } from '../newspaper/NewspaperPageRenderer';

interface TemplateSelectionPanelProps {
  activeTemplateId: NewspaperTemplateId;
  branding: BrandingSettings;
  articles: NewsArticle[];
  selectedArticleIds: string[];
  mainHeadlineId: string;
  onSelectTemplate: (templateId: NewspaperTemplateId) => Promise<void>;
  isSaving: boolean;
}

export const TemplateSelectionPanel: React.FC<TemplateSelectionPanelProps> = ({
  activeTemplateId,
  branding,
  articles,
  selectedArticleIds,
  mainHeadlineId,
  onSelectTemplate,
  isSaving,
}) => {
  const [previewMeta, setPreviewMeta] = useState<NewspaperTemplateMeta | null>(null);

  const articlesMap = useMemo(() => {
    const map: Record<string, NewsArticle> = {};
    for (const a of articles) map[a.id] = a;
    return map;
  }, [articles]);

  const sampleArticles = useMemo(() => {
    const chosen = selectedArticleIds.map((id) => articlesMap[id]).filter(Boolean);
    return chosen.length > 0 ? chosen.slice(0, 7) : articles.slice(0, 7);
  }, [selectedArticleIds, articlesMap, articles]);

  const previewEditionsByTemplate = useMemo(() => {
    const today = getCurrentDhakaEditionDate();
    const map: Record<string, ReturnType<typeof generateNewspaperEdition>> = {};
    for (const tpl of NEWSPAPER_TEMPLATES) {
      map[tpl.id] = generateNewspaperEdition({
        articles: sampleArticles,
        mainHeadlineArticleId: mainHeadlineId || sampleArticles[0]?.id,
        editionDate: today,
        editionNumber: 1,
        title: `${branding.bengaliNameMain} — ${tpl.code}`,
        format: branding.defaultFormat,
        orientation: 'portrait',
        templateId: tpl.id,
        showAds: branding.showAds,
      });
    }
    return map;
  }, [sampleArticles, mainHeadlineId, branding]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-admin-display font-bold text-slate-900">
            Newspaper Template Selection
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Choose from 6 traditional broadsheet templates. Your selected news articles, headlines, images, and official branding automatically arrange into the active template across all pages.
          </p>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
          <Layers className="w-4 h-4 text-red-700" />
          <div className="text-xs">
            <span className="text-slate-500">Currently Active: </span>
            <span className="font-semibold text-slate-900">
              {NEWSPAPER_TEMPLATES.find((t) => t.id === activeTemplateId)?.code} —{' '}
              {NEWSPAPER_TEMPLATES.find((t) => t.id === activeTemplateId)?.name}
            </span>
          </div>
        </div>
      </div>

      {/* 6-Template Visual Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {NEWSPAPER_TEMPLATES.map((tpl) => {
          const isActive = tpl.id === activeTemplateId;
          const previewEdition = previewEditionsByTemplate[tpl.id];
          const firstPage = previewEdition?.pages[0];

          return (
            <div
              key={tpl.id}
              className={`bg-white rounded-xl overflow-hidden flex flex-col transition-all ${
                isActive
                  ? 'border-2 border-red-700 shadow-md'
                  : 'border border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Top Metadata */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-admin-mono font-semibold text-slate-500">
                    <span>{tpl.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{tpl.subtitle}</span>
                  </div>
                  <h3 className="text-sm font-admin-display font-bold text-slate-900 truncate mt-0.5">
                    {tpl.name}
                  </h3>
                </div>

                {isActive && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    Active
                  </span>
                )}
              </div>

              {/* Live Miniature Broadsheet Page Preview */}
              <div className="p-4 bg-stone-200/75 flex items-center justify-center border-b border-slate-200">
                <div className="shadow-md border border-stone-300 bg-white overflow-hidden">
                  {firstPage && (
                    <NewspaperPageRenderer
                      page={firstPage}
                      totalPages={previewEdition.pages.length}
                      allPages={previewEdition.pages}
                      editionDate={previewEdition.editionDate}
                      format="A3"
                      orientation="portrait"
                      templateId={tpl.id}
                      branding={{ ...branding, templateId: tpl.id }}
                      articlesMap={articlesMap}
                      ads={previewEdition.ads}
                      scale={0.28}
                    />
                  )}
                </div>
              </div>

              {/* Description & Actions */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-bn-sans font-semibold text-slate-800">
                    {tpl.bengaliName}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {tpl.description}
                  </p>
                  <div className="mt-2.5 text-[11px] text-slate-500 font-medium space-y-0.5">
                    <div>Layout: {tpl.columnsSummary}</div>
                    <div>Masthead: {tpl.mastheadStyle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPreviewMeta(tpl)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Full Preview
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || isActive}
                    onClick={() => onSelectTemplate(tpl.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-700 text-white cursor-default'
                        : 'bg-red-700 text-white hover:bg-red-600 disabled:opacity-50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isActive ? 'Currently Active' : 'Select & Apply'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-Size Preview Modal */}
      {previewMeta && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-admin-display font-bold text-slate-900">
                  {previewMeta.code}: {previewMeta.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {previewMeta.columnsSummary} · {previewMeta.mastheadStyle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving || previewMeta.id === activeTemplateId}
                  onClick={async () => {
                    await onSelectTemplate(previewMeta.id);
                    setPreviewMeta(null);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {previewMeta.id === activeTemplateId ? 'Currently Active' : 'Apply This Template'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMeta(null)}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-stone-200 overflow-auto flex justify-center">
              {previewEditionsByTemplate[previewMeta.id]?.pages[0] && (
                <NewspaperPageRenderer
                  page={previewEditionsByTemplate[previewMeta.id].pages[0]}
                  totalPages={previewEditionsByTemplate[previewMeta.id].pages.length}
                  allPages={previewEditionsByTemplate[previewMeta.id].pages}
                  editionDate={previewEditionsByTemplate[previewMeta.id].editionDate}
                  format="A3"
                  orientation="portrait"
                  templateId={previewMeta.id}
                  branding={{ ...branding, templateId: previewMeta.id }}
                  articlesMap={articlesMap}
                  ads={previewEditionsByTemplate[previewMeta.id].ads}
                  scale={0.78}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
