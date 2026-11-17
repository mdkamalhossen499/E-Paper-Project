import React from 'react';
import {
  BookOpen,
  FileText,
  Layers,
  Newspaper,
  PlusCircle,
  RefreshCw,
  Rss,
  Sparkles,
} from 'lucide-react';
import {
  AdminNavSection,
  BrandingSettings,
  NewsArticle,
  NewspaperEdition,
} from '../../types/epaper';
import {
  formatDhakaDateTime,
  getCurrentDhakaEditionDate,
  getDhakaCollectionWindowLabel,
} from '../../utils/dhakaTime';

interface DashboardOverviewProps {
  branding: BrandingSettings;
  articles: NewsArticle[];
  selectedArticleIds: string[];
  editions: NewspaperEdition[];
  activeEdition: NewspaperEdition;
  onNavigate: (section: AdminNavSection) => void;
  onRefreshBlogger: () => void;
  isImporting: boolean;
  onOpenEditionInFlipbook: (edition: NewspaperEdition) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  branding,
  articles,
  selectedArticleIds,
  editions,
  activeEdition,
  onNavigate,
  onRefreshBlogger,
  isImporting,
  onOpenEditionInFlipbook,
}) => {
  const todayDhaka = getCurrentDhakaEditionDate();
  const todaysArticles = articles.filter((a) => a.dhakaEditionDate === todayDhaka);
  const totalArchivePages = editions.reduce((sum, ed) => sum + (ed.totalPages || ed.pages.length), 0);

  const stats = [
    {
      label: 'Total Imported News',
      value: articles.length,
      sub: `${articles.filter((a) => a.source === 'blogger').length} from Blogger`,
      icon: Newspaper,
    },
    {
      label: "Today's Published News",
      value: todaysArticles.length,
      sub: '8:00 AM – 8:00 AM (Dhaka)',
      icon: FileText,
    },
    {
      label: 'Selected Articles',
      value: selectedArticleIds.length,
      sub: 'Ready for layout generator',
      icon: Layers,
    },
    {
      label: 'Generated Editions',
      value: editions.length,
      sub: `${totalArchivePages} total pages archived`,
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-admin-display font-bold text-slate-900">
            {branding.englishName} · E-Paper Publishing Control
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Active Collection Window: <span className="font-medium text-slate-800">{getDhakaCollectionWindowLabel(todayDhaka)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {branding.bloggerUrl ? (
            <button
              type="button"
              onClick={onRefreshBlogger}
              disabled={isImporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isImporting ? 'animate-spin' : ''}`} />
              {isImporting ? 'Syncing Blogger...' : 'Sync Blogger Feed'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('blogger')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Rss className="w-3.5 h-3.5" />
              Connect Blogger Site
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('select-news')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Select News & Generate
          </button>

          <button
            type="button"
            onClick={() => onNavigate('flipbook')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open Flipbook Preview
          </button>
        </div>
      </div>

      {/* 4-Column Tabular Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="text-3xl font-admin-mono font-semibold text-slate-900 mt-1.5 tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500 mt-1 truncate">{stat.sub}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Editions & Current Draft Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-admin-display font-bold text-slate-900">
                Recent Newspaper Editions
              </h3>
              <p className="text-xs text-slate-500">
                Published & archived daily editions stored in Cloud Firestore
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
            >
              View All Archive
            </button>
          </div>

          {editions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No archived editions saved yet. Generate and publish today&apos;s edition from the Newspaper Designer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Edition Title</th>
                    <th className="py-2.5 px-4">Dhaka Date</th>
                    <th className="py-2.5 px-4 text-right">Format</th>
                    <th className="py-2.5 px-4 text-right">Pages</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {editions.slice(0, 6).map((ed) => (
                    <tr key={ed.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {ed.title}
                        <span className="ml-2 text-xs font-admin-mono text-slate-400">
                          #{ed.editionNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-admin-mono text-xs text-slate-600">
                        {ed.editionDate}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-600">
                        {ed.format} · {ed.orientation}
                      </td>
                      <td className="py-3 px-4 text-right font-admin-mono text-xs text-slate-800">
                        {ed.pages.length}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenEditionInFlipbook(ed)}
                          className="text-xs font-semibold text-slate-900 hover:text-red-700 transition-colors"
                        >
                          Open Flipbook
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Working Edition Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-admin-display font-bold text-slate-900">
              Active Workspace Edition
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Currently loaded in Designer & Flipbook
            </p>

            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-slate-500">Title</dt>
                <dd className="font-semibold text-slate-900 text-right truncate">
                  {activeEdition.title}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-slate-500">Edition Date</dt>
                <dd className="font-admin-mono text-slate-800">{activeEdition.editionDate}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-slate-500">Page Size</dt>
                <dd className="font-medium text-slate-800">
                  {activeEdition.format} ({activeEdition.orientation})
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-slate-500">Total Pages</dt>
                <dd className="font-admin-mono font-semibold text-slate-900">
                  {activeEdition.pages.length}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-2">
                <dt className="text-slate-500">Latest Article</dt>
                <dd className="text-xs text-slate-600 text-right">
                  {articles[0] ? formatDhakaDateTime(articles[0].publishedAt) : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('designer')}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Edit Layout
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pdf-print')}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              PDF & Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
