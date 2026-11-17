import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Crown,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  BrandingSettings,
  getCanvasDimensions,
  NewsArticle,
  NewspaperEdition,
  NewspaperPage,
  PageArticleSlot,
  PaperFormat,
  PaperOrientation,
} from '../../types/epaper';
import { NewspaperPageRenderer } from '../newspaper/NewspaperPageRenderer';

interface NewspaperDesignerPanelProps {
  edition: NewspaperEdition;
  branding: BrandingSettings;
  articles: NewsArticle[];
  articlesMap: Record<string, NewsArticle>;
  onUpdateEdition: (updated: NewspaperEdition) => void;
  onSaveEditionToArchive: (edition: NewspaperEdition) => Promise<void>;
  isSaving: boolean;
}

export const NewspaperDesignerPanel: React.FC<NewspaperDesignerPanelProps> = ({
  edition,
  branding,
  articles,
  articlesMap,
  onUpdateEdition,
  onSaveEditionToArchive,
  isSaving,
}) => {
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    edition.pages[0]?.slots[0]?.slotId ?? null
  );
  const [addArticleId, setAddArticleId] = useState<string>(articles[0]?.id ?? '');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const safePageIdx = Math.min(activePageIndex, Math.max(0, edition.pages.length - 1));
  const currentPage = edition.pages[safePageIdx];
  const dims = getCanvasDimensions(edition.format, edition.orientation);
  const maxCols = dims.columns;

  const selectedSlot = useMemo(
    () => currentPage?.slots.find((s) => s.slotId === selectedSlotId) ?? null,
    [currentPage, selectedSlotId]
  );

  const previewScale = edition.orientation === 'landscape' ? 0.56 : 0.72;

  const updatePageAt = (pageIdx: number, updater: (page: NewspaperPage) => NewspaperPage) => {
    const nextPages = edition.pages.map((p, idx) => (idx === pageIdx ? updater(p) : p));
    onUpdateEdition({
      ...edition,
      pages: nextPages,
      totalPages: nextPages.length,
    });
  };

  const updateSelectedSlot = (patch: Partial<PageArticleSlot>) => {
    if (!selectedSlotId) return;
    updatePageAt(safePageIdx, (p) => ({
      ...p,
      slots: p.slots.map((s) => (s.slotId === selectedSlotId ? { ...s, ...patch } : s)),
    }));
  };

  const moveSlotOrder = (slotId: string, delta: -1 | 1) => {
    updatePageAt(safePageIdx, (p) => {
      const idx = p.slots.findIndex((s) => s.slotId === slotId);
      const target = idx + delta;
      if (idx === -1 || target < 0 || target >= p.slots.length) return p;
      const copy = [...p.slots];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return { ...p, slots: copy };
    });
  };

  const moveSlotToAnotherPage = (slotId: string, targetPageIndex: number) => {
    if (targetPageIndex === safePageIdx) return;
    const slotToMove = currentPage.slots.find((s) => s.slotId === slotId);
    if (!slotToMove) return;

    const nextPages = edition.pages.map((p, idx) => {
      if (idx === safePageIdx) {
        return { ...p, slots: p.slots.filter((s) => s.slotId !== slotId) };
      }
      if (idx === targetPageIndex) {
        return { ...p, slots: [...p.slots, slotToMove] };
      }
      return p;
    });
    onUpdateEdition({ ...edition, pages: nextPages, totalPages: nextPages.length });
    setActivePageIndex(targetPageIndex);
    setSelectedSlotId(slotId);
  };

  const removeSlot = (slotId: string) => {
    updatePageAt(safePageIdx, (p) => ({
      ...p,
      slots: p.slots.filter((s) => s.slotId !== slotId),
    }));
    setSelectedSlotId(null);
  };

  const setSlotAsMainHeadline = (slotId: string) => {
    updatePageAt(safePageIdx, (p) => {
      const target = p.slots.find((s) => s.slotId === slotId);
      if (!target) return p;
      const others = p.slots
        .filter((s) => s.slotId !== slotId)
        .map((s) => (s.role === 'lead' ? { ...s, role: 'secondary' as const, headlineScale: 'lg' as const } : s));
      const promoted: PageArticleSlot = {
        ...target,
        role: 'lead',
        headlineScale: 'xl',
        colSpan: Math.min(maxCols, Math.max(3, target.colSpan)),
        imagePosition: articlesMap[target.articleId]?.imageUrl ? 'top' : 'none',
        headlinePosition: 'below-image',
      };
      return { ...p, slots: [promoted, ...others] };
    });
  };

  const handleAddPage = () => {
    const nextNum = edition.pages.length + 1;
    const newPage: NewspaperPage = {
      pageNumber: nextNum,
      sectionTitle: `অতিরিক্ত পাতা ${nextNum}`,
      isFrontPage: false,
      slots: [],
      showAdsOnPage: branding.showAds,
    };
    const nextPages = [...edition.pages, newPage];
    onUpdateEdition({
      ...edition,
      pages: nextPages,
      totalPages: nextPages.length,
    });
    setActivePageIndex(nextPages.length - 1);
    setSelectedSlotId(null);
  };

  const handleRemoveCurrentPage = () => {
    if (edition.pages.length <= 1) return;
    const nextPages = edition.pages
      .filter((_, idx) => idx !== safePageIdx)
      .map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
        isFrontPage: idx === 0,
      }));
    onUpdateEdition({
      ...edition,
      pages: nextPages,
      totalPages: nextPages.length,
    });
    setActivePageIndex(Math.max(0, safePageIdx - 1));
    setSelectedSlotId(null);
  };

  const handleAddArticleToCurrentPage = () => {
    const art = articlesMap[addArticleId] || articles[0];
    if (!art) return;
    const newSlot: PageArticleSlot = {
      slotId: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      articleId: art.id,
      colSpan: Math.min(3, maxCols),
      rowSpan: 1,
      role: 'secondary',
      showImage: Boolean(art.imageUrl),
      imagePosition: art.imageUrl ? 'top' : 'none',
      imageHeightPx: 110,
      headlinePosition: 'top',
      headlineScale: 'md',
      customTitle: art.title,
      customContent: art.content || art.summary,
      customCaption: art.imageCaption || '',
      customAuthor: art.author || 'নিজস্ব প্রতিবেদক',
      customCategory: art.category || 'জাতীয়',
      bulletPoints: [],
      continuationText: '',
    };
    updatePageAt(safePageIdx, (p) => ({
      ...p,
      slots: [...p.slots, newSlot],
    }));
    setSelectedSlotId(newSlot.slotId);
  };

  const handleSave = async () => {
    setSaveNotice(null);
    await onSaveEditionToArchive({ ...edition, published: true });
    setSaveNotice('Edition saved & published to Archive.');
    window.setTimeout(() => setSaveNotice(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Top Designer Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500">Edition Title</label>
            <input
              type="text"
              value={edition.title}
              onChange={(e) => onUpdateEdition({ ...edition, title: e.target.value })}
              className="mt-0.5 px-2.5 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg w-56"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500">Paper Size</label>
            <select
              value={edition.format}
              onChange={(e) =>
                onUpdateEdition({ ...edition, format: e.target.value as PaperFormat })
              }
              className="mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="A3">A3 Broadsheet (297×420mm)</option>
              <option value="A4">A4 Compact (210×297mm)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500">Orientation</label>
            <select
              value={edition.orientation}
              onChange={(e) =>
                onUpdateEdition({
                  ...edition,
                  orientation: e.target.value as PaperOrientation,
                })
              }
              className="mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={currentPage?.showAdsOnPage ?? false}
              onChange={(e) =>
                updatePageAt(safePageIdx, (p) => ({ ...p, showAdsOnPage: e.target.checked }))
              }
              className="w-4 h-4 rounded border-slate-300 text-red-700"
            />
            Show Ads on Page {currentPage?.pageNumber}
          </label>
        </div>

        <div className="flex items-center gap-2">
          {saveNotice && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              {saveNotice}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Publishing...' : 'Save & Publish Edition'}
          </button>
        </div>
      </div>

      {/* Page Tabs & Page Management */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {edition.pages.map((p, idx) => (
            <button
              key={p.pageNumber}
              type="button"
              onClick={() => {
                setActivePageIndex(idx);
                setSelectedSlotId(p.slots[0]?.slotId ?? null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                idx === safePageIdx
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Page {p.pageNumber}: {p.sectionTitle}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddPage}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Add Page
          </button>
          {edition.pages.length > 1 && (
            <button
              type="button"
              onClick={handleRemoveCurrentPage}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Page {currentPage?.pageNumber}
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Live Newspaper Broadsheet Canvas + Manual Slot Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Live Broadsheet Canvas */}
        <div className="xl:col-span-8 bg-stone-200/80 border border-slate-300 rounded-xl p-4 overflow-auto flex justify-center">
          {currentPage && (
            <NewspaperPageRenderer
              page={currentPage}
              totalPages={edition.pages.length}
              allPages={edition.pages}
              editionDate={edition.editionDate}
              format={edition.format}
              orientation={edition.orientation}
              templateId={edition.templateId || branding.templateId}
              branding={branding}
              articlesMap={articlesMap}
              ads={edition.ads}
              editable
              selectedSlotId={selectedSlotId}
              onSelectSlot={setSelectedSlotId}
              scale={previewScale}
            />
          )}
        </div>

        {/* Manual Article & Layout Inspector */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-sm font-admin-display font-bold text-slate-900">
              Page {currentPage?.pageNumber} Section & Add News
            </h3>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={currentPage?.sectionTitle ?? ''}
                onChange={(e) =>
                  updatePageAt(safePageIdx, (p) => ({ ...p, sectionTitle: e.target.value }))
                }
                placeholder="Section title (e.g. প্রথম পাতা)"
                className="w-full px-3 py-1.5 text-xs font-bn-sans border border-slate-300 rounded-lg"
              />
              <div className="flex gap-1.5">
                <select
                  value={addArticleId}
                  onChange={(e) => setAddArticleId(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-bn-sans border border-slate-300 rounded-lg bg-white"
                >
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title.slice(0, 48)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddArticleToCurrentPage}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {!selectedSlot ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Click any news article block on the newspaper page to edit its headline, text, image placement, column span, or position.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Selected Article Controls
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSlotAsMainHeadline(selectedSlot.slotId)}
                    title="Promote to Main Headline"
                    className="p-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlotOrder(selectedSlot.slotId, -1)}
                    title="Move earlier on page"
                    className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlotOrder(selectedSlot.slotId, 1)}
                    title="Move later on page"
                    className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlot(selectedSlot.slotId)}
                    title="Remove article from page"
                    className="p-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Headline Text
                </label>
                <textarea
                  rows={2}
                  value={selectedSlot.customTitle}
                  onChange={(e) => updateSelectedSlot({ customTitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs font-bn-serif border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Column Span (1–{maxCols})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={maxCols}
                    value={selectedSlot.colSpan}
                    onChange={(e) => updateSelectedSlot({ colSpan: Number(e.target.value) })}
                    className="w-full accent-red-700"
                  />
                  <div className="text-[11px] font-admin-mono text-slate-500">
                    {selectedSlot.colSpan} / {maxCols} columns
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Row Height Span
                  </label>
                  <select
                    value={selectedSlot.rowSpan}
                    onChange={(e) => updateSelectedSlot({ rowSpan: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>1 Row (Standard)</option>
                    <option value={2}>2 Rows (Tall Lead)</option>
                    <option value={3}>3 Rows (Full Column)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Headline Scale
                  </label>
                  <select
                    value={selectedSlot.headlineScale}
                    onChange={(e) =>
                      updateSelectedSlot({
                        headlineScale: e.target.value as PageArticleSlot['headlineScale'],
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="xl">Extra Large (Main Lead)</option>
                    <option value="lg">Large (Sub-Lead)</option>
                    <option value="md">Medium</option>
                    <option value="sm">Small</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Headline Position
                  </label>
                  <select
                    value={selectedSlot.headlinePosition}
                    onChange={(e) =>
                      updateSelectedSlot({
                        headlinePosition: e.target.value as PageArticleSlot['headlinePosition'],
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="top">Above Image</option>
                    <option value="below-image">Below Top Photo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Image Placement
                  </label>
                  <select
                    value={selectedSlot.imagePosition}
                    onChange={(e) => {
                      const pos = e.target.value as PageArticleSlot['imagePosition'];
                      updateSelectedSlot({
                        imagePosition: pos,
                        showImage: pos !== 'none',
                      });
                    }}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="top">Full Width Top</option>
                    <option value="right">Float Right Inset</option>
                    <option value="left">Float Left Inset</option>
                    <option value="none">Hide Photo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Image Height ({selectedSlot.imageHeightPx}px)
                  </label>
                  <input
                    type="range"
                    min={65}
                    max={300}
                    step={5}
                    value={selectedSlot.imageHeightPx}
                    onChange={(e) =>
                      updateSelectedSlot({ imageHeightPx: Number(e.target.value) })
                    }
                    className="w-full accent-red-700"
                  />
                </div>
              </div>

              {edition.pages.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Move Article to Another Page
                  </label>
                  <select
                    value={safePageIdx}
                    onChange={(e) =>
                      moveSlotToAnotherPage(selectedSlot.slotId, Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {edition.pages.map((p, idx) => (
                      <option key={p.pageNumber} value={idx}>
                        Page {p.pageNumber}: {p.sectionTitle}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Photo Caption
                </label>
                <input
                  type="text"
                  value={selectedSlot.customCaption}
                  onChange={(e) => updateSelectedSlot({ customCaption: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs font-bn-sans border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Article Body Text
                </label>
                <textarea
                  rows={5}
                  value={selectedSlot.customContent}
                  onChange={(e) => updateSelectedSlot({ customContent: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs font-bn-editorial border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
