import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileCode2,
  RefreshCw,
  Rss,
  Upload,
} from 'lucide-react';
import { NewsArticle } from '../../types/epaper';
import {
  BloggerImportResult,
  importFromBloggerUrl,
  parseRssOrAtomXml,
} from '../../utils/blogger';
import { formatDhakaDateTime } from '../../utils/dhakaTime';

interface BloggerConnectionPanelProps {
  bloggerUrl: string;
  onSaveBloggerUrl: (url: string) => void;
  onArticlesImported: (articles: NewsArticle[], sourceLabel: string) => void;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  lastSyncTime: string | null;
  lastSyncStatus: string | null;
}

export const BloggerConnectionPanel: React.FC<BloggerConnectionPanelProps> = ({
  bloggerUrl,
  onSaveBloggerUrl,
  onArticlesImported,
  autoSyncEnabled,
  onToggleAutoSync,
  lastSyncTime,
  lastSyncStatus,
}) => {
  const [urlInput, setUrlInput] = useState<string>(bloggerUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BloggerImportResult | null>(null);
  const [xmlPaste, setXmlPaste] = useState<string>('');
  const [showXmlFallback, setShowXmlFallback] = useState<boolean>(false);

  const handleImport = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const result = await importFromBloggerUrl(urlInput);
      setLastResult(result);
      onSaveBloggerUrl(urlInput.trim());
      onArticlesImported(result.articles, `${result.blogTitle} (${result.method})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to import Blogger feed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleXmlImport = () => {
    setErrorMsg(null);
    try {
      const parsed = parseRssOrAtomXml(xmlPaste);
      if (parsed.articles.length === 0) {
        setErrorMsg('No articles found in the provided RSS/Atom XML.');
        return;
      }
      onArticlesImported(parsed.articles, `${parsed.blogTitle} (XML Import)`);
      setXmlPaste('');
      setShowXmlFallback(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid XML content.');
    }
  };

  const handleXmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setXmlPaste(text);
    setShowXmlFallback(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-admin-display font-bold text-slate-900">
              Blogger Website Integration
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Connect your Blogger website to automatically detect feeds, prevent duplicates, and group articles into 8:00 AM – 8:00 AM (Asia/Dhaka) editions.
            </p>
          </div>
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => onToggleAutoSync(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-red-700 focus:ring-red-700"
            />
            Auto-detect new posts (every 5 min)
          </label>
        </div>

        <form onSubmit={handleImport} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Blogger Website URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Rss className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://yournewssite.blogspot.com or https://www.dharatvnews.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Importing News...' : 'Import / Refresh Feed'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Uses CORS-free public Blogger JSONP (<code className="font-admin-mono">/feeds/posts/default?alt=json-in-script</code>) with automatic Atom/RSS fallback — works directly on GitHub Pages with zero backend or private API keys.
            </p>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {(lastResult || lastSyncStatus) && (
          <div className="mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-slate-900">
                  {lastSyncStatus || `Connected to ${lastResult?.blogTitle}`}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2">
                  {lastResult && (
                    <a
                      href={lastResult.feedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-700 hover:underline"
                    >
                      Feed URL <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {lastSyncTime && (
                    <>
                      <span>·</span>
                      <span className="font-admin-mono">
                        Last synced: {formatDhakaDateTime(lastSyncTime)} (Dhaka)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RSS / Atom XML Manual Import Fallback */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-admin-display font-bold text-slate-900">
              RSS / Atom XML Direct Import (Optional Fallback)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              If your custom domain restricts external feeds, upload or paste your Blogger Atom/RSS XML export here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload XML File
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={handleXmlFileUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowXmlFallback((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              {showXmlFallback ? 'Hide XML Paste' : 'Paste XML'}
            </button>
          </div>
        </div>

        {showXmlFallback && (
          <div className="mt-4 space-y-3">
            <textarea
              value={xmlPaste}
              onChange={(e) => setXmlPaste(e.target.value)}
              rows={6}
              placeholder="Paste Blogger Atom (<feed>...</feed>) or RSS (<rss>...</rss>) XML here..."
              className="w-full p-3 text-xs font-admin-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20"
            />
            <button
              type="button"
              onClick={handleXmlImport}
              disabled={!xmlPaste.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Parse & Import XML Articles
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
