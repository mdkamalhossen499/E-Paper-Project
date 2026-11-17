# DHARA TV NEWS — Automatic Digital E-Paper Generator

A complete, production-ready Automatic E-Paper Generator and Digital Broadsheet Publisher designed around traditional Bangladeshi printed daily newspapers, with Blogger integration, multi-page automatic layout generation, manual layout editing, a realistic two-page 3D flipbook reader, print-ready A3/A4 PDF export, and Cloud Firestore persistence.

## Key Features

- **Traditional Bangladeshi Broadsheet Layout**: Multi-column grid with thin dividing rules, Bengali display masthead (`Noto Serif Bengali` + `Tiro Bangla` + `Hind Siliguri`), fixed official logo container (`object-fit: contain`), promo strip, contact ribbon, bulleted story highlights, photo captions, ads strip, and consistent inner pages.
- **Editable Branding & Logo Settings**: Customize Bengali & English newspaper names (default `DHARA TV NEWS` / `ধারা টিভি নিউজ`), tagline, editor/publisher credits, office address, colors, and upload an official PNG/JPG/JPEG/WebP logo with fixed non-distorting proportions.
- **Blogger News Importer (GitHub Pages Compatible)**: Automatically imports articles from any public Blogger URL using CORS-free JSONP (`/feeds/posts/default?alt=json-in-script`) with Atom/RSS proxy & manual XML fallbacks and duplicate prevention.
- **Asia/Dhaka 8:00 AM – 8:00 AM Edition Grouping**: Automatically groups published articles into daily newspaper editions using `Asia/Dhaka` 8:00 AM to next day 8:00 AM windows.
- **News Selection & Drag-and-Drop Ordering**: Search, filter by date/category, quick-select `4 / 5 / 10 / 15 / 20 / N` articles, drag-and-drop reorder, and mark the Main Headline.
- **Manual Newspaper Designer**: Switch A3/A4 and Portrait/Landscape, add/remove pages, edit headlines/body/captions, adjust column spans, image placement (`top`/`left`/`right`/`none`), image height, headline position, and move articles across pages.
- **Realistic Two-Page 3D Flipbook Viewer**: Side-by-side desktop book spread with 3D page-turn animation, touch swipe on mobile, zoom controls, fullscreen mode, and direct page navigation.
- **Print-Ready PDF & Vector Print**: Export high-DPI A3/A4 PDF files or invoke native browser vector printing (`@page` exact millimeter dimensions) for physical press distribution.
- **Cloud Archive & Protected Admin Studio**: Secured with Firebase Authentication and hardened `firestore.rules` for persistent cross-device editions and branding.

## Project Structure

```text
├── .github/workflows/deploy.yml       # Automated GitHub Pages build & deploy
├── firebase-applet-config.json        # Firebase project configuration
├── firebase-blueprint.json            # Firestore data model blueprint
├── firestore.rules                    # Hardened Firestore security rules
├── index.html                         # Bengali Unicode & Admin fonts + meta
├── vite.config.ts                     # Relative base ('./') for GitHub Pages
└── src/
    ├── App.tsx                        # Public E-Paper Reader & Admin Studio
    ├── firebase.ts                    # Firebase SDK, Auth & error handler
    ├── index.css                      # Broadsheet typography & print CSS
    ├── types/epaper.ts                # Core interfaces & A3/A4 dimensions
    ├── data/defaultData.ts            # Default branding, ads & seed articles
    ├── services/firestoreService.ts   # Firestore CRUD for editions/branding
    ├── utils/
    │   ├── blogger.ts                 # Blogger JSONP/RSS/Atom importer
    │   ├── dhakaTime.ts               # Asia/Dhaka 8AM-8AM & Bangla dates
    │   ├── layoutEngine.ts            # Multi-page broadsheet generator
    │   └── pdfExport.ts               # High-DPI PDF & vector @page print
    └── components/
        ├── newspaper/                 # Broadsheet masthead & page renderer
        ├── flipbook/                  # Two-page 3D flipbook viewer
        └── admin/                     # All 10 Admin Studio modules
```

## GitHub Pages Deployment Instructions

1. **Push this repository to GitHub** (`main` branch).
2. **Enable GitHub Pages**:
   - Go to your repository on GitHub → **Settings** → **Pages**.
   - Under **Build and deployment → Source**, select **GitHub Actions**.
3. **Authorize Domain in Firebase**:
   - Open [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Settings** → **Authorized domains**.
   - Add `<your-username>.github.io` (and your custom domain if used).
4. **Automatic Deployment**:
   - Every push to `main` triggers `.github/workflows/deploy.yml`, runs `npm ci && npm run build`, and deploys `./dist` to GitHub Pages.
5. **Connect to Blogger Menu**:
   - In Blogger Dashboard → **Layout** → **Main Menu / Pages Gadget**, add a new link titled **E-Paper** pointing to your deployed GitHub Pages URL.

## Local Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
