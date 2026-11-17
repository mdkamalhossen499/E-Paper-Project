import { NewspaperTemplateMeta } from '../types/epaper';

export const NEWSPAPER_TEMPLATES: NewspaperTemplateMeta[] = [
  {
    id: 'template-01',
    code: 'Template 01',
    name: 'Classic Bangladeshi Daily (Original)',
    bengaliName: 'ক্লাসিক দৈনিক ব্রডশিট (মূল ডিজাইন)',
    subtitle: 'Your existing printed newspaper design',
    description:
      'Preserves your original traditional Bangladeshi daily layout with 6-column broadsheet grid, crimson contact bar, promo strip, and classic red-bullet summary callouts.',
    columnsSummary: '6 Columns · Asymmetric Lead + Sidebar',
    mastheadStyle: 'Bangladeshi Masthead + Promo Strip',
    accentColor: '#b91c1c',
  },
  {
    id: 'template-02',
    code: 'Template 02',
    name: 'Protidin Broadsheet Edition',
    bengaliName: 'প্রতিদিন ব্রডশিট সংস্করণ',
    subtitle: 'Inspired by Reference Image 1',
    description:
      'Features a large top-left 3-column photo lead with centered jumbo headline, warm cream quote/bullet box, mid-page inline display ad, and bottom dual-photo anchor stories.',
    columnsSummary: '6 Columns · 3-Col Photo Lead + Quote Box',
    mastheadStyle: 'Bangladeshi Masthead + Promo Strip',
    accentColor: '#0284c7',
  },
  {
    id: 'template-03',
    code: 'Template 03',
    name: 'Classical Ink Broadsheet',
    bengaliName: 'ক্লাসিক্যাল ব্ল্যাক-ইঙ্ক ব্রডশিট',
    subtitle: 'Inspired by Reference Image 2',
    description:
      'Authoritative ink-on-newsprint broadsheet with motto ear boxes, double-rule date bar, 1+4+1 symmetric wing columns, italic sub-decks, and 5-column bottom index digest.',
    columnsSummary: '6 Columns · 1+4+1 Symmetric Wing Grid',
    mastheadStyle: 'Double-Rule Classical Masthead',
    accentColor: '#1c1917',
  },
  {
    id: 'template-04',
    code: 'Template 04',
    name: 'Panoramic Banner Broadsheet',
    bengaliName: 'প্যানোরামিক ব্যানার ব্রডশিট',
    subtitle: 'Inspired by Reference Image 3',
    description:
      'Opens with a wide 5-column panoramic top photo showcase paired with a right News Analysis rail, boxed left special report, and wide mid-page banner headline.',
    columnsSummary: '6 Columns · 5-Col Panoramic Top + Analysis Rail',
    mastheadStyle: 'Double-Rule Classical Masthead',
    accentColor: '#334155',
  },
  {
    id: 'template-05',
    code: 'Template 05',
    name: 'Metropolitan Lead Broadsheet',
    bengaliName: 'মেট্রোপলিটন লিড ব্রডশিট',
    subtitle: 'Inspired by Reference Image 4',
    description:
      'Pairs a 4-column top-left lead photograph with a 2-column stacked headline block on the right, a centered mid-page panoramic feature, and a full-width 6-column bottom banner.',
    columnsSummary: '6 Columns · 4+2 Photo-Text Split + Full Banner',
    mastheadStyle: 'Double-Rule Classical Masthead',
    accentColor: '#0f172a',
  },
  {
    id: 'template-06',
    code: 'Template 06',
    name: 'Editorial Color-Framed Daily',
    bengaliName: 'এডিটোরিয়াল ফ্রেমড দৈনিক',
    subtitle: 'Inspired by Reference Image 5',
    description:
      'Modern Bangladeshi political/editorial broadsheet featuring framed Editor’s Desk box, gold/crimson/teal/sky highlight headers, multi-column infographic zone, and color-coded anchors.',
    columnsSummary: '6 Columns · Color-Framed Feature Zones',
    mastheadStyle: 'Bangladeshi Masthead + Framed Sections',
    accentColor: '#0f766e',
  },
];
