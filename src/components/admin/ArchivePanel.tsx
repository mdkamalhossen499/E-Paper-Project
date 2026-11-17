import React, { useMemo, useState } from 'react';
import { BookOpen, Calendar, Edit3, FileDown, Search, Trash2 } from 'lucide-react';
import { NewspaperEdition } from '../../types/epaper';

interface ArchivePanelProps {
  editions: NewspaperEdition[];
  isAdmin: boolean;
  onOpenInFlipbook: (edition: NewspaperEdition) => void;
  onOpenInDesigner?: (edition: NewspaperEdition) => void;
  onOpenPdfExport: (edition: NewspaperEdition) => void;
  onDeleteEdition?: (editionId: string) => Promise<void>;
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({
  editions,
  isAdmin,
  onOpenInFlipbook,
  onOpenInDesigner,
  onOpenPdfExport,
  onDeleteEdition,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = useMemo(() => {
    return editions.filter((ed) => {
      if (dateFilter && ed.editionDate !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ed.title.toLowerCase().includes(q) ||
          ed.editionDate.includes(q) ||
          String(ed.editionNumber).includes(q)
        );
      }
      return true;
    });
  }, [editions, searchQuery, dateFilter]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-admin-display font-bold text-slate-900">
            E-Paper Digital Archive
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Browse historical daily newspaper editions stored persistently in Cloud Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or edition..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg w-56"
            />
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          No historical editions found matching your filter. Publish an edition from the Newspaper Designer to save it to the archive.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ed) => (
            <div
              key={ed.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-admin-mono">
                  <span>Edition #{ed.editionNumber}</span>
                  <span>{ed.editionDate}</span>
                </div>
                <h3 className="text-base font-admin-display font-bold text-slate-900 mt-1.5">
                  {ed.title}
                </h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <span>{ed.pages.length} pages</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ed.format} {ed.orientation}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={ed.published ? 'text-emerald-700 font-medium' : 'text-amber-700'}>
                    {ed.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInFlipbook(ed)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Flipbook
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPdfExport(ed)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </button>
                {isAdmin && onOpenInDesigner && (
                  <button
                    type="button"
                    onClick={() => onOpenInDesigner(ed)}
                    title="Edit in Newspaper Designer"
                    className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin && onDeleteEdition && (
                  <button
                    type="button"
                    onClick={() => onDeleteEdition(ed.id)}
                    title="Delete edition from archive"
                    className="p-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
