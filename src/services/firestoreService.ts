import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { BrandingSettings, NewsArticle, NewspaperEdition } from '../types/epaper';

const BRANDING_PATH = 'settings/branding';
const BOOTSTRAP_OWNER_EMAIL = 'nkhdiary8@gmail.com';

export async function checkIsAdmin(uid: string | undefined, email: string | null | undefined, emailVerified: boolean): Promise<boolean> {
  if (!uid || !emailVerified) return false;
  if (email === BOOTSTRAP_OWNER_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function fetchPublicBranding(): Promise<BrandingSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'branding'));
    if (!snap.exists()) return null;
    return snap.data() as BrandingSettings;
  } catch (error) {
    // Allow fallback to default branding if unauthenticated or offline
    console.warn('Could not read branding from Firestore, using default:', error);
    return null;
  }
}

export async function saveBrandingToFirestore(branding: BrandingSettings): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Admin authentication required.');
  const ref = doc(db, 'settings', 'branding');

  const payload = {
    bengaliNamePrefix: (branding.bengaliNamePrefix || '').slice(0, 80),
    bengaliNameMain: (branding.bengaliNameMain || 'ধারা টিভি নিউজ').slice(0, 120),
    englishName: (branding.englishName || 'DHARA TV NEWS').slice(0, 120),
    tagline: (branding.tagline || '').slice(0, 200),
    logoDataUrl: (branding.logoDataUrl || '').slice(0, 340000),
    editorName: (branding.editorName || '').slice(0, 120),
    publisherName: (branding.publisherName || '').slice(0, 120),
    officeAddress: (branding.officeAddress || '').slice(0, 250),
    contactEmail: (branding.contactEmail || '').slice(0, 120),
    contactPhone: (branding.contactPhone || '').slice(0, 60),
    websiteUrl: (branding.websiteUrl || '').slice(0, 200),
    facebookHandle: (branding.facebookHandle || '').slice(0, 120),
    youtubeHandle: (branding.youtubeHandle || '').slice(0, 120),
    primaryColor: (branding.primaryColor || '#b91c1c').slice(0, 20),
    accentColor: (branding.accentColor || '#0f766e').slice(0, 20),
    paperBackground: (branding.paperBackground || '#fdfcf8').slice(0, 20),
    priceText: (branding.priceText || '').slice(0, 80),
    volumeText: (branding.volumeText || '').slice(0, 80),
    bloggerUrl: (branding.bloggerUrl || '').slice(0, 300),
    showAds: Boolean(branding.showAds),
    defaultFormat: branding.defaultFormat,
    defaultOrientation: branding.defaultOrientation,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        ...payload,
        createdAt: existingSnap.data().createdAt || serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, BRANDING_PATH);
  }
}

export async function fetchPublishedEditions(): Promise<NewspaperEdition[]> {
  try {
    const q = query(
      collection(db, 'editions'),
      where('published', '==', true),
      orderBy('editionDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as NewspaperEdition);
  } catch (error) {
    // Try without orderBy in case composite index isn't built yet
    try {
      const qFallback = query(collection(db, 'editions'), where('published', '==', true));
      const snap = await getDocs(qFallback);
      return snap.docs
        .map((d) => d.data() as NewspaperEdition)
        .sort((a, b) => b.editionDate.localeCompare(a.editionDate));
    } catch (innerErr) {
      console.warn('Firestore editions fetch skipped/offline:', innerErr || error);
      return [];
    }
  }
}

export async function fetchAllAdminEditions(): Promise<NewspaperEdition[]> {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const q =
      user.email === BOOTSTRAP_OWNER_EMAIL
        ? query(collection(db, 'editions'))
        : query(collection(db, 'editions'), where('authorId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as NewspaperEdition)
      .sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'editions');
  }
}

export async function saveEditionToFirestore(edition: NewspaperEdition): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Admin authentication required.');
  const safeId = edition.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const ref = doc(db, 'editions', safeId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        editionDate: edition.editionDate.slice(0, 10),
        editionNumber: edition.editionNumber,
        title: edition.title.slice(0, 200),
        format: edition.format,
        orientation: edition.orientation,
        totalPages: edition.pages.length,
        published: Boolean(edition.published),
        pages: edition.pages,
        ads: edition.ads || [],
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        editionDate: edition.editionDate.slice(0, 10),
        editionNumber: edition.editionNumber,
        title: edition.title.slice(0, 200),
        format: edition.format,
        orientation: edition.orientation,
        totalPages: edition.pages.length,
        published: Boolean(edition.published),
        pages: edition.pages,
        ads: edition.ads || [],
        authorId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `editions/${safeId}`);
  }
}

export async function deleteEditionFromFirestore(editionId: string): Promise<void> {
  const safeId = editionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  try {
    await deleteDoc(doc(db, 'editions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `editions/${safeId}`);
  }
}

export async function fetchAdminArticles(): Promise<NewsArticle[]> {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const q =
      user.email === BOOTSTRAP_OWNER_EMAIL
        ? query(collection(db, 'articles'))
        : query(collection(db, 'articles'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as NewsArticle)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'articles');
  }
}

export async function saveArticlesBatchToFirestore(articles: NewsArticle[]): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  for (const art of articles.slice(0, 60)) {
    const safeId = art.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const ref = doc(db, 'articles', safeId);
    try {
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        await setDoc(ref, {
          id: safeId,
          title: (art.title || 'শিরোনামহীন').slice(0, 400),
          summary: (art.summary || '').slice(0, 2000),
          content: (art.content || '').slice(0, 29000),
          imageUrl: (art.imageUrl || '').slice(0, 2000),
          imageCaption: (art.imageCaption || '').slice(0, 400),
          url: (art.url || '').slice(0, 1000),
          publishedAt: (art.publishedAt || new Date().toISOString()).slice(0, 64),
          dhakaEditionDate: (art.dhakaEditionDate || '').slice(0, 10),
          category: (art.category || 'সাধারণ').slice(0, 80),
          author: (art.author || 'নিজস্ব প্রতিবেদক').slice(0, 120),
          source: art.source === 'blogger' ? 'blogger' : 'manual',
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `articles/${safeId}`);
    }
  }
}
