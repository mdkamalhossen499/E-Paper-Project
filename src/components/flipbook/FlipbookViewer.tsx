import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  FileDown,
  Maximize2,
  Minimize2,
  Printer,
  RotateCcw,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BrandingSettings,
  getCanvasDimensions,
  NewsArticle,
  NewspaperEdition,
} from '../../types/epaper';
import { toBengaliDigits } from '../../utils/dhakaTime';
import { NewspaperPageRenderer } from '../newspaper/NewspaperPageRenderer';

interface FlipbookViewerProps {
  edition: NewspaperEdition;
  branding: BrandingSettings;
  articlesMap: Record<string, NewsArticle>;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  isExportingPdf?: boolean;
}

export const FlipbookViewer: React.FC<FlipbookViewerProps> = ({
  edition,
  branding,
  articlesMap,
  onDownloadPdf,
  onPrint,
  isExportingPdf = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const [singlePageMode, setSinglePageMode] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0); // 0-indexed page in single mode, or left-page index (even) in 2-page spread
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [flipAnim, setFlipAnim] = useState<'next' | 'prev' | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1100);
  const touchStartX = useRef<number | null>(null);

  const pages = edition.pages;
  const totalPages = pages.length;
  const isTwoPage = !isMobile && !singlePageMode && totalPages > 1;

  // Reset to page 1 when edition changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [edition.id]);

  useEffect(() => {
    const updateLayout = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (viewportRef.current) {
        setContainerWidth(viewportRef.current.clientWidth);
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const dims = useMemo(
    () => getCanvasDimensions(edition.format, edition.orientation),
    [edition.format, edition.orientation]
  );

  // Auto-fit scale so two pages side-by-side fit comfortably inside the reader stage
  const baseFitScale = useMemo(() => {
    const availableW = Math.max(320, containerWidth - 56);
    const targetPagesWidth = isTwoPage ? dims.width * 2 + 12 : dims.width;
    const wScale = availableW / targetPagesWidth;
    const maxH = isFullscreen ? window.innerHeight - 130 : Math.max(520, window.innerHeight - 250);
    const hScale = maxH / dims.height;
    return Math.min(1.05, Math.max(0.24, Math.min(wScale, hScale)));
  }, [containerWidth, dims.width, dims.height, isTwoPage, isFullscreen]);

  const effectiveScale = Number((baseFitScale * zoomMultiplier).toFixed(3));
  const step = isTwoPage ? 2 : 1;

  const triggerFlip = useCallback(
    (direction: 'next' | 'prev', targetIdx: number) => {
      setFlipAnim(direction);
      window.setTimeout(() => {
        setCurrentIndex(targetIdx);
      }, 210);
      window.setTimeout(() => {
        setFlipAnim(null);
      }, 520);
    },
    []
  );

  const goToPage = useCallback(
    (pageIndexZeroBased: number) => {
      const clamped = Math.max(0, Math.min(totalPages - 1, pageIndexZeroBased));
      const aligned = isTwoPage ? clamped - (clamped % 2) : clamped;
      if (aligned === currentIndex) return;
      triggerFlip(aligned > currentIndex ? 'next' : 'prev', aligned);
    },
    [currentIndex, isTwoPage, totalPages, triggerFlip]
  );

  const handleNext = useCallback(() => {
    const nextIdx = currentIndex + step;
    if (nextIdx < totalPages) {
      triggerFlip('next', nextIdx);
    }
  }, [currentIndex, step, totalPages, triggerFlip]);

  const handlePrev = useCallback(() => {
    const prevIdx = Math.max(0, currentIndex - step);
    if (prevIdx !== currentIndex) {
      triggerFlip('prev', prevIdx);
    }
  }, [currentIndex, step, triggerFlip]);

  const handleFirst = () => goToPage(0);
  const handleLast = () => goToPage(totalPages - 1);

  // Keyboard arrow navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 45) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
  };

  const leftPage = pages[currentIndex];
  const rightPage = isTwoPage ? pages[currentIndex + 1] : undefined;

  const canPrev = currentIndex > 0;
  const canNext = currentIndex + step < totalPages;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-stone-900 text-stone-100 rounded-xl overflow-hidden border border-stone-800 ${
        isFullscreen ? 'h-screen rounded-none border-none' : ''
      }`}
    >
      {/* Top Flipbook Control Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-stone-950 border-b border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-admin-display font-semibold text-white truncate">
            {edition.title}
          </span>
          <span className="text-xs text-stone-400 font-admin-mono whitespace-nowrap">
            · {edition.format} {edition.orientation} · {totalPages} pages
          </span>
        </div>

        {/* Page Jump Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFirst}
            disabled={!canPrev}
            title="First page"
            className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canPrev}
            title="Previous page"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          <div className="flex items-center gap-1 px-2">
            {pages.map((p, idx) => {
              const isActive = isTwoPage
                ? idx === currentIndex || idx === currentIndex + 1
                : idx === currentIndex;
              return (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => goToPage(idx)}
                  className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-admin-mono transition-colors ${
                    isActive
                      ? 'bg-red-700 text-white font-semibold'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {p.pageNumber}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext}
            title="Next page"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLast}
            disabled={!canNext}
            title="Last page"
            className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom, Spread Mode & Export Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMobile && totalPages > 1 && (
            <button
              type="button"
              onClick={() => setSinglePageMode((v) => !v)}
              title={isTwoPage ? 'Switch to single page view' : 'Switch to two-page spread'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors whitespace-nowrap"
            >
              {isTwoPage ? <Square className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
              {isTwoPage ? '1-Page' : '2-Page'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            title="Zoom out"
            className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-admin-mono text-stone-300 min-w-[44px] text-center">
            {Math.round(zoomMultiplier * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.min(1.85, Number((z + 0.15).toFixed(2))))}
            title="Zoom in"
            className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoomMultiplier !== 1 && (
            <button
              type="button"
              onClick={() => setZoomMultiplier(1)}
              title="Reset zoom"
              className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen mode'}
            className="p-2 rounded-md text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-stone-800 text-stone-100 hover:bg-stone-700 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          )}

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5" />
              {isExportingPdf ? 'Building PDF...' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Realistic 3D Book-Spread Reading Stage */}
      <div
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 min-h-[520px] overflow-auto flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,#292524_0%,#1c1917_70%,#0c0a09_100%)]"
      >
        {/* Left Floating Edge Turn Trigger */}
        {canPrev && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Turn to previous newspaper page"
            className="no-print hidden md:flex fixed-inside absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-14 rounded-lg bg-black/55 hover:bg-black/80 text-white items-center justify-center border border-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Floating Edge Turn Trigger */}
        {canNext && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Turn to next newspaper page"
            className="no-print hidden md:flex fixed-inside absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-14 rounded-lg bg-black/55 hover:bg-black/80 text-white items-center justify-center border border-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* 3D Perspective Book Spread */}
        <div className="flipbook-perspective relative flex items-center justify-center">
          <div
            className="relative flex items-stretch shadow-[0_28px_60px_-12px_rgba(0,0,0,0.85)] rounded-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform:
                flipAnim === 'next'
                  ? 'rotateY(-6deg) scale(0.985)'
                  : flipAnim === 'prev'
                  ? 'rotateY(6deg) scale(0.985)'
                  : 'rotateY(0deg) scale(1)',
            }}
          >
            {/* Left Sheet */}
            {leftPage && (
              <div className="relative">
                <NewspaperPageRenderer
                  page={leftPage}
                  totalPages={totalPages}
                  allPages={pages}
                  editionDate={edition.editionDate}
                  format={edition.format}
                  orientation={edition.orientation}
                  templateId={edition.templateId || branding.templateId}
                  branding={branding}
                  articlesMap={articlesMap}
                  ads={edition.ads}
                  scale={effectiveScale}
                />
                {isTwoPage && (
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 flipbook-spine-left" />
                )}
              </div>
            )}

            {/* Center Fold Spine Divider */}
            {isTwoPage && rightPage && (
              <div className="w-[2px] bg-stone-500/80 shadow-[0_0_12px_rgba(0,0,0,0.65)] z-10" />
            )}

            {/* Right Sheet */}
            {isTwoPage && rightPage && (
              <div className="relative">
                <NewspaperPageRenderer
                  page={rightPage}
                  totalPages={totalPages}
                  allPages={pages}
                  editionDate={edition.editionDate}
                  format={edition.format}
                  orientation={edition.orientation}
                  templateId={edition.templateId || branding.templateId}
                  branding={branding}
                  articlesMap={articlesMap}
                  ads={edition.ads}
                  scale={effectiveScale}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 flipbook-spine-right" />
              </div>
            )}

            {/* Dynamic Page-Turn Curl Shadow Flap */}
            {flipAnim && (
              <div
                className={`pointer-events-none absolute inset-y-0 w-1/2 z-30 transition-all duration-300 ${
                  flipAnim === 'next'
                    ? 'right-0 bg-gradient-to-l from-black/35 via-white/15 to-transparent origin-left -skew-y-1'
                    : 'left-0 bg-gradient-to-r from-black/35 via-white/15 to-transparent origin-right skew-y-1'
                }`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Reading Indicator */}
      <div className="no-print px-4 py-2 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 font-bn-sans">
        <span>
          {isTwoPage && rightPage
            ? `পৃষ্ঠা ${toBengaliDigits(leftPage.pageNumber)} ও ${toBengaliDigits(rightPage.pageNumber)} প্রদর্শিত হচ্ছে`
            : `পৃষ্ঠা ${toBengaliDigits(leftPage?.pageNumber ?? 1)} / ${toBengaliDigits(totalPages)}`}
        </span>
        <span className="hidden sm:inline text-stone-500 font-admin-display">
          Use Left/Right arrows or swipe on mobile to turn pages
        </span>
      </div>
    </div>
  );
};
