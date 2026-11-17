const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

const BENGALI_WEEKDAYS: Record<string, string> = {
  Sunday: 'রবিবার',
  Monday: 'সোমবার',
  Tuesday: 'মঙ্গলবার',
  Wednesday: 'বুধবার',
  Thursday: 'বৃহস্পতিবার',
  Friday: 'শুক্রবার',
  Saturday: 'শনিবার',
};

const BENGALI_GREGORIAN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const BANGLA_MONTHS = [
  'বৈশাখ',
  'জ্যৈষ্ঠ',
  'আষাঢ়',
  'শ্রাবণ',
  'ভাদ্র',
  'আশ্বিন',
  'কার্তিক',
  'অগ্রহায়ণ',
  'পৌষ',
  'মাঘ',
  'ফাল্গুন',
  'চৈত্র',
];

interface DhakaDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: string;
}

export function getDhakaParts(dateInput: Date | string): DhakaDateParts {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  const parts = fmt.formatToParts(safeDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  let hour = Number(map.hour ?? '0');
  if (hour === 24) hour = 0;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: map.weekday ?? 'Monday',
  };
}

/**
 * Computes the newspaper edition date using the Bangladesh 8:00 AM to 8:00 AM rule:
 * Articles published between Nov 16 08:00 AM and Nov 17 07:59 AM (Asia/Dhaka)
 * belong to the Nov 16 edition.
 */
export function getDhakaEditionDate(publishedAt: Date | string): string {
  const parts = getDhakaParts(publishedAt);
  const baseUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  if (parts.hour < 8) {
    baseUtc.setUTCDate(baseUtc.getUTCDate() - 1);
  }
  const y = baseUtc.getUTCFullYear();
  const m = String(baseUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(baseUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentDhakaEditionDate(): string {
  return getDhakaEditionDate(new Date());
}

export function getDhakaCollectionWindowLabel(editionDate: string): string {
  const [y, m, d] = editionDate.split('-').map(Number);
  if (!y || !m || !d) return editionDate;
  const start = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmt.format(start)}, 8:00 AM — ${fmt.format(end)}, 8:00 AM (Asia/Dhaka)`;
}

/**
 * Approximate Bangla calendar date (Revised Bangladesh Bangla Academy calendar)
 */
export function getBanglaCalendarDate(editionDate: string): string {
  const [y, m, d] = editionDate.split('-').map(Number);
  if (!y || !m || !d) return '';

  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  // Bangla New Year starts April 14
  const startOfBanglaMonths: Array<{ monthIdx: number; gMonth: number; gDay: number }> = [
    { monthIdx: 0, gMonth: 4, gDay: 14 }, // Boishakh
    { monthIdx: 1, gMonth: 5, gDay: 15 }, // Joishtho
    { monthIdx: 2, gMonth: 6, gDay: 15 }, // Asharh
    { monthIdx: 3, gMonth: 7, gDay: 16 }, // Srabon
    { monthIdx: 4, gMonth: 8, gDay: 16 }, // Bhadro
    { monthIdx: 5, gMonth: 9, gDay: 16 }, // Ashwin
    { monthIdx: 6, gMonth: 10, gDay: 17 }, // Kartik
    { monthIdx: 7, gMonth: 11, gDay: 16 }, // Ogrohayon
    { monthIdx: 8, gMonth: 12, gDay: 16 }, // Poush
    { monthIdx: 9, gMonth: 1, gDay: 15 }, // Magh
    { monthIdx: 10, gMonth: 2, gDay: 14 }, // Falgun
    { monthIdx: 11, gMonth: 3, gDay: isLeap ? 15 : 15 }, // Choitro
  ];

  const targetUtc = Date.UTC(y, m - 1, d);
  let banglaYear = m > 4 || (m === 4 && d >= 14) ? y - 593 : y - 594;
  let chosen = startOfBanglaMonths[8];
  let chosenUtc = Date.UTC(y, 11, 16);

  // Check in chronological order across current and previous Gregorian year
  const candidates: Array<{ monthIdx: number; utc: number }> = [];
  for (const item of startOfBanglaMonths) {
    const gy = item.gMonth <= 3 && m >= 4 ? y + 1 : item.gMonth >= 4 && m <= 3 ? y - 1 : y;
    candidates.push({
      monthIdx: item.monthIdx,
      utc: Date.UTC(gy, item.gMonth - 1, item.gDay),
    });
  }
  candidates.sort((a, b) => a.utc - b.utc);

  for (const c of candidates) {
    if (c.utc <= targetUtc) {
      chosen = startOfBanglaMonths.find((s) => s.monthIdx === c.monthIdx)!;
      chosenUtc = c.utc;
    }
  }

  const banglaDay = Math.floor((targetUtc - chosenUtc) / 86400000) + 1;
  return `${toBengaliDigits(banglaDay)} ${BANGLA_MONTHS[chosen.monthIdx]} ${toBengaliDigits(banglaYear)}`;
}

export function getHijriApproxDate(editionDate: string): string {
  const [y, m, d] = editionDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  try {
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const parts = fmt.formatToParts(date);
    const hDay = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
    const hMonth = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
    const hYear = Number(parts.find((p) => p.type === 'year')?.value ?? '1448');

    const hijriMonthsBn = [
      'মহররম',
      'সফর',
      'রবিউল আউয়াল',
      'রবিউস সানি',
      'জমাদিউল আউয়াল',
      'জমাদিউস সানি',
      'রজব',
      'শাবান',
      'রমজান',
      'শাওয়াল',
      'জিলকদ',
      'জিলহজ',
    ];
    return `${toBengaliDigits(hDay)} ${hijriMonthsBn[(hMonth - 1) % 12]} ${toBengaliDigits(hYear)}`;
  } catch {
    return '';
  }
}

export function formatBengaliNewspaperDate(editionDate: string): {
  weekdayBn: string;
  gregorianBn: string;
  banglaDateBn: string;
  hijriDateBn: string;
} {
  const [y, m, d] = editionDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y || 2026, (m || 11) - 1, d || 16, 12, 0, 0));
  const weekdayEn = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(dateObj);

  return {
    weekdayBn: BENGALI_WEEKDAYS[weekdayEn] ?? 'সোমবার',
    gregorianBn: `${toBengaliDigits(d || 16)} ${BENGALI_GREGORIAN_MONTHS[((m || 11) - 1) % 12]} ${toBengaliDigits(y || 2026)}`,
    banglaDateBn: getBanglaCalendarDate(editionDate),
    hijriDateBn: getHijriApproxDate(editionDate),
  };
}

export function formatDhakaDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
