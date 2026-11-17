import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Archive,
  BookOpen,
  CheckSquare,
  FileDown,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Lock,
  Menu,
  Newspaper,
  Palette,
  Rss,
  Settings,
  X,
} from 'lucide-react';
import { auth, logoutAdmin, testFirestoreConnection } from './firebase';
import {
  checkIsAdmin,
  deleteEditionFromFirestore,
  fetchAdminArticles,
  fetchAllAdminEditions,
  fetchPublicBranding,
  fetchPublishedEditions,
  saveArticlesBatchToFirestore,
  saveBrandingToFirestore,
  saveEditionToFirestore,
} from './services/firestoreService';
import {
  AdminNavSection,
  BrandingSettings,
  NewsArticle,
  NewspaperEdition,
  NewspaperTemplateId,
  PaperFormat,
  PaperOrientation,
} from './types/epaper';
import { createInitialSeedArticles, DEFAULT_BRANDING } from './data/defaultData';
import { NEWSPAPER_TEMPLATES } from './data/templates';
import { getCurrentDhakaEditionDate } from './utils/dhakaTime';
import { importFromBloggerUrl, mergeDeduplicatedArticles } from './utils/blogger';
import { generateNewspaperEdition } from './utils/layoutEngine';
import { exportPagesToPrintPdf, triggerNativeVectorPrint } from './utils/pdfExport';
import { FixedLogoBox } from './components/newspaper/NewspaperMasthead';
import { NewspaperPageRenderer } from './components/newspaper/NewspaperPageRenderer';
import { FlipbookViewer } from './components/flipbook/FlipbookViewer';
import { DashboardOverview } from './components/admin/DashboardOverview';
import { BloggerConnectionPanel } from './components/admin/BloggerConnectionPanel';
import { AllNewsAndSelectPanel } from './components/admin/AllNewsAndSelectPanel';
import { TemplateSelectionPanel } from './components/admin/TemplateSelectionPanel';
import { NewspaperDesignerPanel } from './components/admin/NewspaperDesignerPanel';
import { PdfPrintPanel } from './components/admin/PdfPrintPanel';
import { ArchivePanel } from './components/admin/ArchivePanel';
import { BrandingSettingsPanel } from './components/admin/BrandingSettingsPanel';
import {
  AdminLoginGate,
  AdminSecuritySettingsPanel,
} from './components/admin/AdminAuthAndSecurityPanel';

const NAV_ITEMS: Array<{ id: AdminNavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'blogger', label: 'Blogger Connection', icon: Rss },
  { id: 'all-news', label: 'All News', icon: Newspaper },
  { id: 'select-news', label: 'Select News', icon: CheckSquare },
  { id: 'templates', label: 'Newspaper Template Selection', icon: LayoutGrid },
  { id: 'designer', label: 'Newspaper Designer', icon: LayoutTemplate },
  { id: 'flipbook', label: 'Flipbook Preview', icon: BookOpen },
  { id: 'pdf-print', label: 'PDF Download & Print', icon: FileDown },
  { id: 'archive', label: 'E-Paper Archive', icon: Archive },
  { id: 'branding', label: 'Branding & Logo Settings', icon: Palette },
  { id: 'settings', label: 'Admin Settings', icon: Settings },
];

export default function App() {
  const [viewMode, setViewMode] = useState<'reader' | 'admin'>('reader');
  const [readerTab, setReaderTab] = useState<'flipbook' | 'archive'>('flipbook');
  const [adminSection, setAdminSection] = useState<AdminNavSection>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  // Core Domain State
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    try {
      const saved = localStorage.getItem('dhara_branding_v1');
      return saved ? { ...DEFAULT_BRANDING, ...JSON.parse(saved) } : DEFAULT_BRANDING;
    } catch {
      return DEFAULT_BRANDING;
    }
  });

  const [articles, setArticles] = useState<NewsArticle[]>(() => {
    try {
      const saved = localStorage.getItem('dhara_articles_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as NewsArticle[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createInitialSeedArticles();
  });

  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>(() =>
    createInitialSeedArticles().map((a) => a.id)
  );
  const [mainHeadlineId, setMainHeadlineId] = useState<string>(
    () => createInitialSeedArticles()[0]?.id ?? ''
  );

  const [editions, setEditions] = useState<NewspaperEdition[]>(() => {
    try {
      const saved = localStorage.getItem('dhara_editions_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as NewspaperEdition[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const seed = createInitialSeedArticles();
    return [
      generateNewspaperEdition({
        articles: seed,
        mainHeadlineArticleId: seed[0]?.id,
        editionDate: getCurrentDhakaEditionDate(),
        editionNumber: 1,
        title: `${DEFAULT_BRANDING.bengaliNameMain} — দৈনিক সংস্করণ`,
        format: DEFAULT_BRANDING.defaultFormat,
        orientation: DEFAULT_BRANDING.defaultOrientation,
        templateId: DEFAULT_BRANDING.templateId,
        showAds: DEFAULT_BRANDING.showAds,
      }),
    ];
  });

  const [activeEdition, setActiveEdition] = useState<NewspaperEdition>(() => {
    const seed = createInitialSeedArticles();
    return generateNewspaperEdition({
      articles: seed,
      mainHeadlineArticleId: seed[0]?.id,
      editionDate: getCurrentDhakaEditionDate(),
      editionNumber: 1,
      title: `${DEFAULT_BRANDING.bengaliNameMain} — দৈনিক সংস্করণ`,
      format: DEFAULT_BRANDING.defaultFormat,
      orientation: DEFAULT_BRANDING.defaultOrientation,
      templateId: DEFAULT_BRANDING.templateId,
      showAds: DEFAULT_BRANDING.showAds,
    });
  });

  // Sync activeEdition on mount from editions[0] if cached
  useEffect(() => {
    if (editions[0]) {
      setActiveEdition(editions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Status & Actions
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingReaderPdf, setIsExportingReaderPdf] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const readerPrintRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const articlesMap = useMemo(() => {
    const map: Record<string, NewsArticle> = {};
    for (const art of articles) {
      map[art.id] = art;
    }
    return map;
  }, [articles]);

  // Boot: Test Firestore & load public branding + published editions
  useEffect(() => {
    testFirestoreConnection();

    (async () => {
      const remoteBranding = await fetchPublicBranding();
      if (remoteBranding) {
        setBranding((prev) => ({ ...prev, ...remoteBranding }));
      }
      const remoteEditions = await fetchPublishedEditions();
      if (remoteEditions.length > 0) {
        setEditions(remoteEditions);
        setActiveEdition(remoteEditions[0]);
      }
    })();

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const ok = await checkIsAdmin(
          currentUser.uid,
          currentUser.email,
          currentUser.emailVerified
        );
        setIsAuthorizedAdmin(ok);
        if (ok) {
          try {
            const [adminEditions, adminArticles] = await Promise.all([
              fetchAllAdminEditions(),
              fetchAdminArticles(),
            ]);
            if (adminEditions.length > 0) {
              setEditions(adminEditions);
              setActiveEdition(adminEditions[0]);
            }
            if (adminArticles.length > 0) {
              setArticles((prev) => mergeDeduplicatedArticles(prev, adminArticles).merged);
            }
          } catch (err) {
            console.warn('Could not sync admin Firestore collections:', err);
          }
        }
      } else {
        setIsAuthorizedAdmin(false);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Persist local resilience cache
  useEffect(() => {
    try {
      localStorage.setItem('dhara_branding_v1', JSON.stringify(branding));
    } catch {
      // ignore quota
    }
  }, [branding]);

  useEffect(() => {
    try {
      localStorage.setItem('dhara_articles_v1', JSON.stringify(articles.slice(0, 120)));
    } catch {
      // ignore quota
    }
  }, [articles]);

  useEffect(() => {
    try {
      localStorage.setItem('dhara_editions_v1', JSON.stringify(editions.slice(0, 15)));
    } catch {
      // ignore quota
    }
  }, [editions]);

  const handleArticlesImported = useCallback(
    async (incoming: NewsArticle[], sourceLabel: string) => {
      let addedCount = 0;
      setArticles((prev) => {
        const res = mergeDeduplicatedArticles(prev, incoming);
        addedCount = res.addedCount;
        return res.merged;
      });
      setLastSyncTime(new Date().toISOString());
      setLastSyncStatus(
        `Synced ${sourceLabel}: ${incoming.length} fetched, ${addedCount} new articles added.`
      );
      showToast(`Imported ${addedCount} new articles from ${sourceLabel}`);

      if (isAuthorizedAdmin) {
        try {
          await saveArticlesBatchToFirestore(incoming);
        } catch (err) {
          console.warn('Firestore article sync note:', err);
        }
      }
    },
    [isAuthorizedAdmin, showToast]
  );

  const handleRefreshBlogger = useCallback(async () => {
    if (!branding.bloggerUrl) {
      setAdminSection('blogger');
      return;
    }
    setIsImporting(true);
    try {
      const result = await importFromBloggerUrl(branding.bloggerUrl);
      await handleArticlesImported(result.articles, `${result.blogTitle} (${result.method})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Blogger sync failed.');
    } finally {
      setIsImporting(false);
    }
  }, [branding.bloggerUrl, handleArticlesImported, showToast]);

  // Auto-detect new Blogger posts every 5 minutes when enabled
  useEffect(() => {
    if (!autoSyncEnabled || !branding.bloggerUrl) return;
    const id = window.setInterval(() => {
      handleRefreshBlogger();
    }, 300000);
    return () => window.clearInterval(id);
  }, [autoSyncEnabled, branding.bloggerUrl, handleRefreshBlogger]);

  const handleSaveBranding = async (updated: BrandingSettings) => {
    setIsSaving(true);
    try {
      setBranding(updated);
      if (isAuthorizedAdmin) {
        await saveBrandingToFirestore(updated);
      }
      showToast('Newspaper branding & logo saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save branding.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBloggerUrl = async (url: string) => {
    const next = { ...branding, bloggerUrl: url };
    setBranding(next);
    if (isAuthorizedAdmin) {
      try {
        await saveBrandingToFirestore(next);
      } catch {
        // non-blocking
      }
    }
  };

  const handleAddManualArticle = async (article: NewsArticle) => {
    setArticles((prev) => [article, ...prev]);
    setSelectedArticleIds((prev) => [article.id, ...prev]);
    if (!mainHeadlineId) setMainHeadlineId(article.id);
    if (isAuthorizedAdmin) {
      try {
        await saveArticlesBatchToFirestore([article]);
      } catch {
        // non-blocking
      }
    }
    showToast('Manual article added to news pool.');
  };

  const handleDeleteArticle = (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setSelectedArticleIds((prev) => prev.filter((x) => x !== id));
  };

  const handleGenerateNewspaper = () => {
    const chosen = selectedArticleIds
      .map((id) => articlesMap[id])
      .filter(Boolean);
    if (chosen.length === 0) {
      showToast('Select at least one article first.');
      return;
    }

    const editionDate = chosen[0]?.dhakaEditionDate || getCurrentDhakaEditionDate();
    const nextNumber = editions.length + 1;
    const generated = generateNewspaperEdition({
      articles: chosen,
      mainHeadlineArticleId: mainHeadlineId,
      editionDate,
      editionNumber: nextNumber,
      title: `${branding.bengaliNameMain} — ${editionDate}`,
      format: branding.defaultFormat,
      orientation: branding.defaultOrientation,
      templateId: branding.templateId || 'template-01',
      showAds: branding.showAds,
      existingAds: activeEdition.ads,
    });

    setActiveEdition(generated);
    setAdminSection('designer');
    showToast(`Generated ${generated.pages.length}-page newspaper edition.`);
  };

  const handleSelectTemplate = async (templateId: NewspaperTemplateId) => {
    setIsSaving(true);
    try {
      const nextBranding: BrandingSettings = { ...branding, templateId };
      setBranding(nextBranding);

      const chosen = selectedArticleIds
        .map((id) => articlesMap[id])
        .filter(Boolean);
      const sourceArticles = chosen.length > 0 ? chosen : articles;

      const regenerated = generateNewspaperEdition({
        articles: sourceArticles,
        mainHeadlineArticleId: mainHeadlineId || sourceArticles[0]?.id,
        editionDate: activeEdition.editionDate || getCurrentDhakaEditionDate(),
        editionNumber: activeEdition.editionNumber || 1,
        title: activeEdition.title || `${nextBranding.bengaliNameMain} — ${activeEdition.editionDate}`,
        format: activeEdition.format || nextBranding.defaultFormat,
        orientation: activeEdition.orientation || nextBranding.defaultOrientation,
        templateId,
        showAds: nextBranding.showAds,
        existingAds: activeEdition.ads,
      });

      const updatedEdition: NewspaperEdition = {
        ...regenerated,
        id: activeEdition.id,
        published: activeEdition.published,
      };

      setActiveEdition(updatedEdition);
      setEditions((prev) => {
        const exists = prev.some((e) => e.id === updatedEdition.id);
        return exists
          ? prev.map((e) => (e.id === updatedEdition.id ? updatedEdition : e))
          : [updatedEdition, ...prev];
      });

      if (isAuthorizedAdmin) {
        await saveBrandingToFirestore(nextBranding);
        if (updatedEdition.published) {
          await saveEditionToFirestore(updatedEdition);
        }
      }

      const tplMeta = NEWSPAPER_TEMPLATES.find((t) => t.id === templateId);
      showToast(
        `${tplMeta ? `${tplMeta.code} (${tplMeta.name})` : templateId} applied across all pages.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEditionToArchive = async (edition: NewspaperEdition) => {
    setIsSaving(true);
    try {
      setActiveEdition(edition);
      setEditions((prev) => {
        const exists = prev.some((e) => e.id === edition.id);
        return exists
          ? prev.map((e) => (e.id === edition.id ? edition : e))
          : [edition, ...prev];
      });
      if (isAuthorizedAdmin) {
        await saveEditionToFirestore(edition);
      }
      showToast('Edition published and archived successfully.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save edition.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEdition = async (editionId: string) => {
    setEditions((prev) => prev.filter((e) => e.id !== editionId));
    if (isAuthorizedAdmin) {
      try {
        await deleteEditionFromFirestore(editionId);
        showToast('Edition deleted from archive.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete edition.');
      }
    }
  };

  const handleDownloadReaderPdf = async () => {
    const els = activeEdition.pages
      .map((p) => readerPrintRefs.current[p.pageNumber])
      .filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;

    setIsExportingReaderPdf(true);
    try {
      await exportPagesToPrintPdf({
        pageElements: els,
        format: activeEdition.format,
        orientation: activeEdition.orientation,
        fileName: `${branding.englishName.replace(/\s+/g, '-')}-${activeEdition.editionDate}.pdf`,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF download failed.');
    } finally {
      setIsExportingReaderPdf(false);
    }
  };

  // PUBLIC E-PAPER READER MODE (Default landing for Blogger E-Paper menu visitors)
  if (viewMode === 'reader') {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col">
        {/* Clean 3-Zone Top Bar Contract */}
        <header className="no-print bg-white border-b border-stone-200 px-4 lg:px-8 py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <FixedLogoBox branding={branding} variant="inner" />
            <span className="text-base font-bn-serif font-extrabold text-stone-950 whitespace-nowrap">
              {branding.bengaliNameMain}
            </span>
          </div>

          <nav className="flex items-center gap-5 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => setReaderTab('flipbook')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                readerTab === 'flipbook'
                  ? 'text-red-700 font-semibold border-b-2 border-red-700'
                  : 'hover:text-stone-900'
              }`}
            >
              Today&apos;s E-Paper
            </button>
            <button
              type="button"
              onClick={() => setReaderTab('archive')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                readerTab === 'archive'
                  ? 'text-red-700 font-semibold border-b-2 border-red-700'
                  : 'hover:text-stone-900'
              }`}
            >
              Archive ({editions.length})
            </button>
            <select
              value={activeEdition.id}
              onChange={(e) => {
                const found = editions.find((ed) => ed.id === e.target.value);
                if (found) {
                  setActiveEdition(found);
                  setReaderTab('flipbook');
                }
              }}
              aria-label="Select Edition Date"
              className="hidden sm:block text-xs font-admin-mono border border-stone-300 rounded-lg px-2.5 py-1.5 bg-stone-50 text-stone-800"
            >
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.editionDate} · #{ed.editionNumber}
                </option>
              ))}
            </select>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('admin')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              Admin Studio
            </button>
          </div>
        </header>

        <main className="no-print flex-1 p-3 sm:p-5 max-w-[1440px] w-full mx-auto">
          {readerTab === 'flipbook' ? (
            <FlipbookViewer
              edition={activeEdition}
              branding={branding}
              articlesMap={articlesMap}
              onDownloadPdf={handleDownloadReaderPdf}
              onPrint={() =>
                triggerNativeVectorPrint(activeEdition.format, activeEdition.orientation)
              }
              isExportingPdf={isExportingReaderPdf}
            />
          ) : (
            <ArchivePanel
              editions={editions}
              isAdmin={false}
              onOpenInFlipbook={(ed) => {
                setActiveEdition(ed);
                setReaderTab('flipbook');
              }}
              onOpenPdfExport={(ed) => {
                setActiveEdition(ed);
                setReaderTab('flipbook');
              }}
            />
          )}
        </main>

        {/* Unscaled Print & Reader PDF Source */}
        <div
          aria-hidden="true"
          className="print-only-container fixed -left-[99999px] top-0 pointer-events-none"
        >
          {activeEdition.pages.map((page) => (
            <NewspaperPageRenderer
              key={`reader-export-${page.pageNumber}`}
              page={page}
              totalPages={activeEdition.pages.length}
              allPages={activeEdition.pages}
              editionDate={activeEdition.editionDate}
              format={activeEdition.format}
              orientation={activeEdition.orientation}
              templateId={activeEdition.templateId || branding.templateId}
              branding={branding}
              articlesMap={articlesMap}
              ads={activeEdition.ads}
              scale={1}
              pageRef={(el) => {
                readerPrintRefs.current[page.pageNumber] = el;
              }}
            />
          ))}
        </div>

        {toastMessage && (
          <div className="no-print fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // AUTHENTICATION GATE FOR PROTECTED ADMIN DASHBOARD
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-600">
        Checking admin session...
      </div>
    );
  }

  if (!user || !isAuthorizedAdmin) {
    return (
      <AdminLoginGate
        user={user}
        isAuthorizedAdmin={isAuthorizedAdmin}
        onCancelToReader={() => setViewMode('reader')}
      />
    );
  }

  // PROTECTED ADMIN DASHBOARD WORKSPACE
  const currentNavLabel = NAV_ITEMS.find((n) => n.id === adminSection)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar Navigation (256px desktop, drawer on mobile) */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-admin-display font-bold text-white truncate">
              {branding.englishName}
            </div>
            <div className="text-[11px] text-slate-400 truncate">E-Paper Publisher Studio</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = adminSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAdminSection(item.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-red-700 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="truncate font-medium text-slate-200">{user.email}</div>
          <button
            type="button"
            onClick={() => setViewMode('reader')}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold transition-colors"
          >
            Public E-Paper Reader
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Admin Header */}
        <header className="no-print bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-admin-display font-bold text-slate-900 truncate">
              Admin Studio <span className="text-slate-400 mx-1.5">/</span> {currentNavLabel}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Reader View
            </button>
          </div>
        </header>

        {/* Active Admin Module Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {adminSection === 'dashboard' && (
            <DashboardOverview
              branding={branding}
              articles={articles}
              selectedArticleIds={selectedArticleIds}
              editions={editions}
              activeEdition={activeEdition}
              onNavigate={setAdminSection}
              onRefreshBlogger={handleRefreshBlogger}
              isImporting={isImporting}
              onOpenEditionInFlipbook={(ed) => {
                setActiveEdition(ed);
                setAdminSection('flipbook');
              }}
            />
          )}

          {adminSection === 'blogger' && (
            <BloggerConnectionPanel
              bloggerUrl={branding.bloggerUrl}
              onSaveBloggerUrl={handleSaveBloggerUrl}
              onArticlesImported={handleArticlesImported}
              autoSyncEnabled={autoSyncEnabled}
              onToggleAutoSync={setAutoSyncEnabled}
              lastSyncTime={lastSyncTime}
              lastSyncStatus={lastSyncStatus}
            />
          )}

          {(adminSection === 'all-news' || adminSection === 'select-news') && (
            <AllNewsAndSelectPanel
              mode={adminSection === 'select-news' ? 'select' : 'all'}
              articles={articles}
              selectedIds={selectedArticleIds}
              mainHeadlineId={mainHeadlineId}
              onChangeSelectedIds={setSelectedArticleIds}
              onChangeMainHeadlineId={setMainHeadlineId}
              onAddManualArticle={handleAddManualArticle}
              onDeleteArticle={handleDeleteArticle}
              onGenerateNewspaper={handleGenerateNewspaper}
            />
          )}

          {adminSection === 'templates' && (
            <TemplateSelectionPanel
              activeTemplateId={branding.templateId || 'template-01'}
              branding={branding}
              articles={articles}
              selectedArticleIds={selectedArticleIds}
              mainHeadlineId={mainHeadlineId}
              onSelectTemplate={handleSelectTemplate}
              isSaving={isSaving}
            />
          )}

          {adminSection === 'designer' && (
            <NewspaperDesignerPanel
              edition={activeEdition}
              branding={branding}
              articles={articles}
              articlesMap={articlesMap}
              onUpdateEdition={setActiveEdition}
              onSaveEditionToArchive={handleSaveEditionToArchive}
              isSaving={isSaving}
            />
          )}

          {adminSection === 'flipbook' && (
            <FlipbookViewer
              edition={activeEdition}
              branding={branding}
              articlesMap={articlesMap}
              onDownloadPdf={() => setAdminSection('pdf-print')}
              onPrint={() => setAdminSection('pdf-print')}
            />
          )}

          {adminSection === 'pdf-print' && (
            <PdfPrintPanel
              edition={activeEdition}
              branding={branding}
              articlesMap={articlesMap}
              onUpdateFormat={(format: PaperFormat, orientation: PaperOrientation) =>
                setActiveEdition((prev) => ({ ...prev, format, orientation }))
              }
            />
          )}

          {adminSection === 'archive' && (
            <ArchivePanel
              editions={editions}
              isAdmin
              onOpenInFlipbook={(ed) => {
                setActiveEdition(ed);
                setAdminSection('flipbook');
              }}
              onOpenInDesigner={(ed) => {
                setActiveEdition(ed);
                setAdminSection('designer');
              }}
              onOpenPdfExport={(ed) => {
                setActiveEdition(ed);
                setAdminSection('pdf-print');
              }}
              onDeleteEdition={handleDeleteEdition}
            />
          )}

          {adminSection === 'branding' && (
            <BrandingSettingsPanel
              branding={branding}
              onSaveBranding={handleSaveBranding}
              isSaving={isSaving}
            />
          )}

          {adminSection === 'settings' && (
            <AdminSecuritySettingsPanel
              user={user}
              onLogout={async () => {
                await logoutAdmin();
                setViewMode('reader');
              }}
            />
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="no-print fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
