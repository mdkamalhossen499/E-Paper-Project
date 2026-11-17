import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { PAPER_MM, PaperFormat, PaperOrientation } from '../types/epaper';

/**
 * Converts external cross-origin images inside a DOM subtree to inline data URLs
 * before rendering to PNG/PDF so html-to-image never fails or drops images due to CORS.
 */
async function inlineCrossOriginImages(container: HTMLElement): Promise<() => void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  const restoreFns: Array<() => void> = [];

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
        return;
      }
      // External URL (e.g. Blogger blogspot CDN)
      try {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        if (dataUrl) {
          const originalSrc = src;
          img.setAttribute('src', dataUrl);
          restoreFns.push(() => img.setAttribute('src', originalSrc));
        }
      } catch {
        // Keep original src if proxy fails
      }
    })
  );

  return () => {
    restoreFns.forEach((fn) => fn());
  };
}

export async function exportPagesToPrintPdf(options: {
  pageElements: HTMLElement[];
  format: PaperFormat;
  orientation: PaperOrientation;
  fileName: string;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { pageElements, format, orientation, fileName, onProgress } = options;
  if (pageElements.length === 0) {
    throw new Error('No newspaper pages selected for export.');
  }

  const mm = PAPER_MM[format][orientation];
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [mm.width, mm.height],
    compress: true,
  });

  // Ensure web fonts are loaded before rasterizing
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  for (let i = 0; i < pageElements.length; i++) {
    onProgress?.(i + 1, pageElements.length);
    const el = pageElements[i];
    const restoreImages = await inlineCrossOriginImages(el);

    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: format === 'A3' ? 2.5 : 3,
        backgroundColor: '#fdfcf8',
        skipAutoScale: true,
      });

      if (i > 0) {
        pdf.addPage([mm.width, mm.height], orientation);
      }

      pdf.addImage(dataUrl, 'PNG', 0, 0, mm.width, mm.height, undefined, 'FAST');
    } finally {
      restoreImages();
    }
  }

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Injects an exact @page print rule matching the selected A3/A4 format & orientation
 * and invokes browser native print (which renders true 1:1 vector Bengali Unicode text).
 */
export function triggerNativeVectorPrint(format: PaperFormat, orientation: PaperOrientation): void {
  const styleId = 'dhara-dynamic-print-page-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const mm = PAPER_MM[format][orientation];
  styleEl.textContent = `
    @page {
      size: ${mm.width}mm ${mm.height}mm;
      margin: 0;
    }
    @media print {
      .print-page-break {
        width: ${mm.width}mm !important;
        height: ${mm.height}mm !important;
      }
    }
  `;

  window.print();
}
