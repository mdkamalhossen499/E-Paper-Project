import React, { useState } from 'react';
import { CheckCircle2, ImagePlus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { BrandingSettings, PaperFormat, PaperOrientation } from '../../types/epaper';
import { DEFAULT_BRANDING } from '../../data/defaultData';
import { FixedLogoBox } from '../newspaper/NewspaperMasthead';

interface BrandingSettingsPanelProps {
  branding: BrandingSettings;
  onSaveBranding: (updated: BrandingSettings) => Promise<void>;
  isSaving: boolean;
}

async function compressLogoFile(file: File): Promise<string> {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Please upload a PNG, JPG, JPEG, or WebP logo image.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  // Load into Image and preserve aspect ratio within max 480px box
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 480;
      let w = img.naturalWidth || 240;
      let h = img.naturalHeight || 180;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      // Preserve transparency with PNG for PNG logos, otherwise WebP
      const outputMime = file.type === 'image/png' ? 'image/png' : 'image/webp';
      resolve(canvas.toDataURL(outputMime, 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const BrandingSettingsPanel: React.FC<BrandingSettingsPanelProps> = ({
  branding,
  onSaveBranding,
  isSaving,
}) => {
  const [draft, setDraft] = useState<BrandingSettings>(branding);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const updateField = <K extends keyof BrandingSettings>(
    key: K,
    value: BrandingSettings[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoFile(file);
      updateField('logoDataUrl', compressed);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Logo upload failed.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(null);
    await onSaveBranding(draft);
    setSavedNotice('Branding & logo settings saved permanently.');
    window.setTimeout(() => setSavedNotice(null), 4000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Live Fixed Masthead & Logo Proportion Preview */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-admin-display font-bold text-slate-900">
              Branding, Masthead & Official Logo Settings
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Customize the newspaper name, official logo, editor/publisher credits, and print colors. Changes automatically apply across all pages, flipbooks, and PDFs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_BRANDING)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Branding Permanently'}
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedNotice}
          </div>
        )}

        {/* Fixed Logo Container & Live Masthead Preview */}
        <div className="mt-5 p-4 rounded-xl border border-stone-300 bg-[#fdfcf8]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">
            Live Fixed Masthead & Logo Container Preview (104×76px · object-fit: contain)
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 border-y border-stone-300 py-3">
            <FixedLogoBox branding={draft} variant="masthead" />
            <div className="flex-1 text-center sm:text-left min-w-0">
              {draft.bengaliNamePrefix && (
                <div
                  className="text-xs font-bold font-bn-sans tracking-[0.2em]"
                  style={{ color: draft.accentColor }}
                >
                  {draft.bengaliNamePrefix}
                </div>
              )}
              <div className="text-3xl font-black font-bn-serif text-stone-950 truncate">
                {draft.bengaliNameMain}
              </div>
              <div className="text-xs text-stone-600 mt-0.5">
                <span className="font-admin-display font-bold tracking-widest uppercase text-stone-800">
                  {draft.englishName}
                </span>
                {draft.tagline && <span> · {draft.tagline}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Upload & Newspaper Names */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-admin-display font-bold text-slate-900">
            Official Newspaper Logo
          </h3>
          <p className="text-xs text-slate-500">
            Supports PNG, JPG, JPEG, and WebP. Rendered inside a fixed container using <code className="font-admin-mono">object-fit: contain</code> so your logo is never stretched or distorted across editions or PDFs.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <FixedLogoBox branding={draft} variant="masthead" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                {draft.logoDataUrl ? 'Replace Logo' : 'Upload Official Logo'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>

              {draft.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => updateField('logoDataUrl', '')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Logo
                </button>
              )}
            </div>
          </div>

          {logoError && (
            <p className="text-xs text-red-700 font-medium">{logoError}</p>
          )}

          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bengali Kicker / Prefix
              </label>
              <input
                type="text"
                value={draft.bengaliNamePrefix}
                onChange={(e) => updateField('bengaliNamePrefix', e.target.value)}
                placeholder="দৈনিক"
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bengali Newspaper Name
              </label>
              <input
                type="text"
                required
                value={draft.bengaliNameMain}
                onChange={(e) => updateField('bengaliNameMain', e.target.value)}
                placeholder="ধারা টিভি নিউজ"
                className="w-full px-3 py-2 text-sm font-bn-serif font-bold border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                English Newspaper Name
              </label>
              <input
                type="text"
                required
                value={draft.englishName}
                onChange={(e) => updateField('englishName', e.target.value)}
                placeholder="DHARA TV NEWS"
                className="w-full px-3 py-2 text-sm font-admin-display font-semibold border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tagline / Slogan
              </label>
              <input
                type="text"
                value={draft.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Publisher, Contact, Colors & Default Page Setup */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-admin-display font-bold text-slate-900">
            Editorial Credits, Contact & Print Defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Editor Name
              </label>
              <input
                type="text"
                value={draft.editorName}
                onChange={(e) => updateField('editorName', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Publisher Name
              </label>
              <input
                type="text"
                value={draft.publisherName}
                onChange={(e) => updateField('publisherName', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office Address
              </label>
              <input
                type="text"
                value={draft.officeAddress}
                onChange={(e) => updateField('officeAddress', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="text"
                value={draft.websiteUrl}
                onChange={(e) => updateField('websiteUrl', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={draft.contactEmail}
                onChange={(e) => updateField('contactEmail', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Facebook Handle
              </label>
              <input
                type="text"
                value={draft.facebookHandle}
                onChange={(e) => updateField('facebookHandle', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                YouTube Handle
              </label>
              <input
                type="text"
                value={draft.youtubeHandle}
                onChange={(e) => updateField('youtubeHandle', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Volume & Issue Text
              </label>
              <input
                type="text"
                value={draft.volumeText}
                onChange={(e) => updateField('volumeText', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pages & Price Label
              </label>
              <input
                type="text"
                value={draft.priceText}
                onChange={(e) => updateField('priceText', e.target.value)}
                className="w-full px-3 py-2 text-sm font-bn-sans border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Colors & Print Defaults */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Primary Masthead Color
              </label>
              <input
                type="color"
                value={draft.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="w-full h-9 rounded border border-slate-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Section Accent Color
              </label>
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => updateField('accentColor', e.target.value)}
                className="w-full h-9 rounded border border-slate-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Newsprint Paper Tint
              </label>
              <input
                type="color"
                value={draft.paperBackground}
                onChange={(e) => updateField('paperBackground', e.target.value)}
                className="w-full h-9 rounded border border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Format
              </label>
              <select
                value={draft.defaultFormat}
                onChange={(e) => updateField('defaultFormat', e.target.value as PaperFormat)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="A3">A3 Newspaper</option>
                <option value="A4">A4 Compact</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Orientation
              </label>
              <select
                value={draft.defaultOrientation}
                onChange={(e) =>
                  updateField('defaultOrientation', e.target.value as PaperOrientation)
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showAds}
                  onChange={(e) => updateField('showAds', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-red-700"
                />
                Show Ads Section
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
