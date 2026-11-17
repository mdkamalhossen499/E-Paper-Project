import React, { useRef, useState } from 'react';
import { CheckSquare, FileDown, Printer, Square } from 'lucide-react';
import {
  BrandingSettings,
  NewsArticle,
  NewspaperEdition,
  PaperFormat,
  PaperOrientation,
} from '../../types/epaper';
import { exportPagesToPrintPdf, triggerNativeVectorPrint } from '../../utils/pdfExport';
import { NewspaperPageRenderer } from '../newspaper/NewspaperPageRenderer';

interface PdfPrintPanelProps {
  edition: NewspaperEdition;
  branding: BrandingSettings;
  articlesMap: Record<string, NewsArticle>;
  onUpdateFormat: (format: PaperFormat, orientation: PaperOrientation) => void;
}

export const PdfPrintPanel: React.FC<PdfPrintPanelProps> = ({
  edition,
  branding,
  articlesMap,
  onUpdateFormat,
}) => {
  const [selectedPageNumbers, setSelectedPageNumbers] = useState<number[]>(() =>
    edition.pages.map((p) => p.pageNumber)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pageNodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const togglePage = (pageNum: number) => {
    setSelectedPageNumbers((prev) =>
      prev.includes(pageNum)
        ? prev.filter((n) => n !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const selectAllPages = () => {
    setSelectedPageNumbers(edition.pages.map((p) => p.pageNumber));
  };

  const handleDownloadPdf = async () => {
    setErrorMsg(null);
    const orderedNums = edition.pages
      .map((p) => p.pageNumber)
      .filter((n) => selectedPageNumbers.includes(n));

    const targetEls = orderedNums
      .map((num) => pageNodeRefs.current[num])
      .filter(Boolean) as HTMLDivElement[];

    if (targetEls.length === 0) {
      setErrorMsg('Please select at least one page to download.');
      return;
    }

    setIsExporting(true);
    try {
      await exportPagesToPrintPdf({
        pageElements: targetEls,
        format: edition.format,
        orientation: edition.orientation,
        fileName: `${branding.englishName.replace(/\s+/g, '-')}-${edition.editionDate}-${edition.format}.pdf`,
        onProgress: (cur, tot) => setProgressText(`Rendering print page ${cur} of ${tot}...`),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setIsExporting(false);
      setProgressText(null);
    }
  };

  const handleVectorPrint = () => {
    triggerNativeVectorPrint(edition.format, edition.orientation);
  };

  const selectedPagesToPrint = edition.pages.filter((p) =>
    selectedPageNumbers.includes(p.pageNumber)
  );

  return (
    <div className="space-y-6">
      <div className="no-print bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-admin-display font-bold text-slate-900">
              Print-Ready PDF Download & Physical Press Print
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Exports full-resolution broadsheet pages with exact A3/A4 millimeter dimensions, fixed masthead & logo, and crisp Bengali Unicode shaping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleVectorPrint}
              disabled={selectedPagesToPrint.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print / Vector Save PDF
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting || selectedPagesToPrint.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? progressText || 'Generating PDF...' : 'Download High-Res PDF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Print Paper Format
            </label>
            <select
              value={edition.format}
              onChange={(e) =>
                onUpdateFormat(e.target.value as PaperFormat, edition.orientation)
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="A3">A3 Newspaper (297 × 420 mm)</option>
              <option value="A4">A4 Standard (210 × 297 mm)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Page Orientation
            </label>
            <select
              value={edition.orientation}
              onChange={(e) =>
                onUpdateFormat(edition.format, e.target.value as PaperOrientation)
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Select Pages to Print / Export
              </label>
              <button
                type="button"
                onClick={selectAllPages}
                className="text-xs font-semibold text-red-700 hover:underline"
              >
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {edition.pages.map((p) => {
                const checked = selectedPageNumbers.includes(p.pageNumber);
                return (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => togglePage(p.pageNumber)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-admin-mono border transition-colors ${
                      checked
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    P{p.pageNumber}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Print Preview Grid (visible in browser preview AND acts as exact source for PDF & @media print) */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedPagesToPrint.map((page) => (
          <div
            key={page.pageNumber}
            className="bg-stone-200/80 border border-slate-300 rounded-xl p-4 flex flex-col items-center overflow-auto"
          >
            <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 mb-2.5">
              <span>
                Page {page.pageNumber} — {page.sectionTitle}
              </span>
              <span className="font-admin-mono text-slate-500">
                {edition.format} {edition.orientation}
              </span>
            </div>
            <NewspaperPageRenderer
              page={page}
              totalPages={edition.pages.length}
              allPages={edition.pages}
              editionDate={edition.editionDate}
              format={edition.format}
              orientation={edition.orientation}
              templateId={edition.templateId || branding.templateId}
              branding={branding}
              articlesMap={articlesMap}
              ads={edition.ads}
              scale={edition.orientation === 'landscape' ? 0.42 : 0.52}
            />
          </div>
        ))}
      </div>

      {/* Unscaled Hidden Print & High-DPI Export DOM Nodes */}
      <div
        aria-hidden="true"
        className="print-only-container fixed -left-[99999px] top-0 pointer-events-none"
      >
        {selectedPagesToPrint.map((page) => (
          <NewspaperPageRenderer
            key={`export-${page.pageNumber}`}
            page={page}
            totalPages={edition.pages.length}
            allPages={edition.pages}
            editionDate={edition.editionDate}
            format={edition.format}
            orientation={edition.orientation}
            templateId={edition.templateId || branding.templateId}
            branding={branding}
            articlesMap={articlesMap}
            ads={edition.ads}
            scale={1}
            pageRef={(el) => {
              pageNodeRefs.current[page.pageNumber] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
};
