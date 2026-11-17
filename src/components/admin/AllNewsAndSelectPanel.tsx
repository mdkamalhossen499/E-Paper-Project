import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckSquare,
  Crown,
  Eye,
  GripVertical,
  Newspaper,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { NewsArticle } from '../../types/epaper';
import {
  formatDhakaDateTime,
  getCurrentDhakaEditionDate,
  getDhakaCollectionWindowLabel,
  getDhakaEditionDate,
} from '../../utils/dhakaTime';

interface AllNewsAndSelectPanelProps {
  mode: 'all' | 'select';
  articles: NewsArticle[];
  selectedIds: string[];
  mainHeadlineId: string;
  onChangeSelectedIds: (ids: string[]) => void;
  onChangeMainHeadlineId: (id: string) => void;
  onAddManualArticle: (article: NewsArticle) => void;
  onDeleteArticle: (id: string) => void;
  onGenerateNewspaper: () => void;
}

export const AllNewsAndSelectPanel: React.FC<AllNewsAndSelectPanelProps> = ({
  mode,
  articles,
  selectedIds,
  mainHeadlineId,
  onChangeSelectedIds,
  onChangeMainHeadlineId,
  onAddManualArticle,
  onDeleteArticle,
  onGenerateNewspaper,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customCountInput, setCustomCountInput] = useState<string>('6');
  const [previewArticle, setPreviewArticle] = useState<NewsArticle | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Manual article form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('জাতীয়');
  const [newAuthor, setNewAuthor] = useState('নিজস্ব প্রতিবেদক');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newContent, setNewContent] = useState('');

  const uniqueDates = useMemo(() => {
    const set = new Set(articles.map((a) => a.dhakaEditionDate));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [articles]);

  const uniqueCategories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category || 'সাধারণ'));
    return Array.from(set);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (selectedDateFilter !== 'all' && a.dhakaEditionDate !== selectedDateFilter) {
        return false;
      }
      if (selectedCategory !== 'all' && (a.category || 'সাধারণ') !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [articles, selectedDateFilter, selectedCategory, searchQuery]);

  const selectedArticlesOrdered = useMemo(() => {
    const map = new Map(articles.map((a) => [a.id, a]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as NewsArticle[];
  }, [articles, selectedIds]);

  const toggleArticle = (id: string) => {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((x) => x !== id);
      onChangeSelectedIds(next);
      if (mainHeadlineId === id && next.length > 0) {
        onChangeMainHeadlineId(next[0]);
      }
    } else {
      const next = [...selectedIds, id];
      onChangeSelectedIds(next);
      if (!mainHeadlineId) {
        onChangeMainHeadlineId(id);
      }
    }
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredArticles.map((a) => a.id);
    const merged = Array.from(new Set([...selectedIds, ...filteredIds]));
    onChangeSelectedIds(merged);
    if (!mainHeadlineId && merged.length > 0) onChangeMainHeadlineId(merged[0]);
  };

  const deselectAll = () => {
    onChangeSelectedIds([]);
  };

  const quickSelectN = (n: number) => {
    const picked = filteredArticles.slice(0, Math.max(1, n)).map((a) => a.id);
    onChangeSelectedIds(picked);
    if (picked.length > 0) {
      onChangeMainHeadlineId(picked[0]);
    }
  };

  const moveSelected = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= selectedIds.length) return;
    const copy = [...selectedIds];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    onChangeSelectedIds(copy);
  };

  const handleDropOnSelected = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const copy = [...selectedIds];
    const fromIdx = copy.indexOf(draggedId);
    const toIdx = copy.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    onChangeSelectedIds(copy);
    setDraggedId(null);
  };

  const handleCreateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const nowIso = new Date().toISOString();
    const article: NewsArticle = {
      id: `manual_${Date.now().toString(36)}`,
      title: newTitle.trim(),
      summary: newContent.trim().slice(0, 220),
      content: newContent.trim(),
      imageUrl: newImageUrl.trim(),
      imageCaption: newCaption.trim() || newTitle.trim(),
      url: '',
      publishedAt: nowIso,
      dhakaEditionDate: getDhakaEditionDate(nowIso),
      category: newCategory.trim() || 'জাতীয়',
      author: newAuthor.trim() || 'নিজস্ব প্রতিবেদক',
      source: 'manual',
    };
    onAddManualArticle(article);
    setNewTitle('');
    setNewContent('');
    setNewImageUrl('');
    setNewCaption('');
    setShowAddModal(false);
  };

  const todayDhaka = getCurrentDhakaEditionDate();

  return (
    <div className="space-y-5">
      {/* Filter & Quick Select Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-admin-display font-bold text-slate-900">
              {mode === 'select' ? 'Select & Order News for Newspaper' : 'All Imported News Archive'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Grouped strictly by Asia/Dhaka 8:00 AM – 8:00 AM edition windows · Today&apos;s edition: {todayDhaka}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual News
            </button>

            <button
              type="button"
              onClick={onGenerateNewspaper}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-45 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Newspaper ({selectedIds.length})
            </button>
          </div>
        </div>

        {/* Search, Date Filter, Category Filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bengali or English headline..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20"
            />
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
            >
              <option value="all">All Edition Dates ({articles.length})</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {d === todayDhaka ? `Today (${d})` : d} ·{' '}
                  {articles.filter((a) => a.dhakaEditionDate === d).length} news
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {selectedDateFilter !== 'all' && (
          <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            Collection Window: <span className="font-semibold">{getDhakaCollectionWindowLabel(selectedDateFilter)}</span>
          </div>
        )}

        {/* Quick Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 whitespace-nowrap"
            >
              Select All ({filteredArticles.length})
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700 whitespace-nowrap"
            >
              Deselect All
            </button>
            <span className="text-xs text-slate-400 px-1">|</span>
            {[4, 5, 10, 15, 20].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => quickSelectN(num)}
                className="px-2.5 py-1.5 text-xs font-admin-mono font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 whitespace-nowrap"
              >
                Top {num}
              </button>
            ))}
            <div className="inline-flex items-center gap-1 ml-1">
              <input
                type="number"
                min={1}
                max={60}
                value={customCountInput}
                onChange={(e) => setCustomCountInput(e.target.value)}
                className="w-14 px-2 py-1 text-xs font-admin-mono border border-slate-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => quickSelectN(Number(customCountInput) || 6)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Pick N
              </button>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-600 font-admin-mono">
            {selectedIds.length} selected of {articles.length} total
          </span>
        </div>
      </div>

      {/* Main Split: Left Article Catalog + Right Selected Queue (Drag & Drop) */}
      <div className={`grid grid-cols-1 ${mode === 'select' ? 'xl:grid-cols-12' : ''} gap-6`}>
        {/* Left List */}
        <div className={`${mode === 'select' ? 'xl:col-span-7' : ''} bg-white border border-slate-200 rounded-xl overflow-hidden`}>
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Available News Articles ({filteredArticles.length})</span>
            <span>Click checkbox to include in edition</span>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No articles match the current search or Asia/Dhaka date filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
              {filteredArticles.map((art) => {
                const isSelected = selectedIds.includes(art.id);
                const isMain = mainHeadlineId === art.id && isSelected;
                return (
                  <div
                    key={art.id}
                    className={`p-4 flex items-start gap-3.5 transition-colors ${
                      isSelected ? 'bg-red-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleArticle(art.id)}
                      className="mt-0.5 text-slate-600 hover:text-red-700 shrink-0"
                      aria-label={`Select ${art.title}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-red-700" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    {art.imageUrl ? (
                      <img
                        src={art.imageUrl}
                        alt={art.title}
                        className="w-20 h-14 object-cover rounded border border-slate-200 shrink-0 bg-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-14 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Newspaper className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold font-bn-serif text-slate-900 leading-snug">
                        {art.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{art.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{art.author}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-admin-mono">{art.dhakaEditionDate}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDhakaDateTime(art.publishedAt)}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-bn-sans line-clamp-2 mt-1">
                        {art.summary}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewArticle(art)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 rounded hover:bg-white text-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => onChangeMainHeadlineId(art.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                            isMain
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                          }`}
                        >
                          <Crown className="w-3 h-3" />
                          {isMain ? 'Main Lead' : 'Set Lead'}
                        </button>
                      )}
                      {art.source === 'manual' && (
                        <button
                          type="button"
                          onClick={() => onDeleteArticle(art.id)}
                          title="Remove manual article"
                          className="p-1 text-slate-400 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Drag & Drop Sequence Queue */}
        {mode === 'select' && (
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Selected Edition Order ({selectedArticlesOrdered.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Drag to reorder priority · Lead story goes to Page 1 top
                </p>
              </div>
            </div>

            {selectedArticlesOrdered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Select articles from the left panel to build your newspaper edition.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
                {selectedArticlesOrdered.map((art, index) => {
                  const isMain = mainHeadlineId === art.id;
                  return (
                    <div
                      key={art.id}
                      draggable
                      onDragStart={() => setDraggedId(art.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnSelected(art.id)}
                      className={`p-3 flex items-center gap-2.5 bg-white hover:bg-slate-50 cursor-grab active:cursor-grabbing ${
                        draggedId === art.id ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="w-6 text-center font-admin-mono text-xs font-semibold text-slate-500 shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold font-bn-serif text-slate-900 truncate">
                          {art.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{art.category}</span>
                          {isMain && (
                            <span className="font-semibold text-amber-700">· Main Headline</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onChangeMainHeadlineId(art.id)}
                          title="Mark as Main Headline"
                          className={`p-1.5 rounded ${
                            isMain
                              ? 'bg-amber-100 text-amber-800'
                              : 'text-slate-400 hover:text-amber-700 hover:bg-slate-100'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelected(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelected(index, 1)}
                          disabled={index === selectedArticlesOrdered.length - 1}
                          className="p-1.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleArticle(art.id)}
                          title="Exclude from edition"
                          className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Article Full Preview Modal */}
      {previewArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">
                {previewArticle.category} · {previewArticle.dhakaEditionDate} ·{' '}
                {previewArticle.author}
              </div>
              <button
                type="button"
                onClick={() => setPreviewArticle(null)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <h3 className="text-xl font-bold font-bn-serif text-slate-900">
                {previewArticle.title}
              </h3>
              {previewArticle.imageUrl && (
                <figure>
                  <img
                    src={previewArticle.imageUrl}
                    alt={previewArticle.title}
                    className="w-full max-h-72 object-cover rounded-lg border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  {previewArticle.imageCaption && (
                    <figcaption className="text-xs text-slate-500 mt-1.5 font-bn-sans">
                      {previewArticle.imageCaption}
                    </figcaption>
                  )}
                </figure>
              )}
              <div className="text-sm font-bn-editorial text-slate-800 leading-relaxed whitespace-pre-line">
                {previewArticle.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Breaking News Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateManual}
            className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-admin-display font-bold text-slate-900">
                Add Manual News Article
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bengali / English Headline
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bn-serif border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Author / Reporter
                  </label>
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Photo Caption (Optional)
                </label>
                <input
                  type="text"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Article Body
                </label>
                <textarea
                  required
                  rows={6}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bn-editorial border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white hover:bg-red-600"
              >
                Save Article
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
