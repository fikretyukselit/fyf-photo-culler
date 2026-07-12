import { useSyncExternalStore } from "react";

export type Locale = "en" | "tr";

const translations = {
  en: {
    // Landing
    "app.title": "FYF Photo Culler",
    "app.subtitle": "AI-powered photo culling and organization",
    "landing.selectFolders": "Select Folders",
    "landing.selectOutput": "Select Output Folder",
    "landing.mergeMode": "Merge all into single output",
    "landing.startCulling": "Start Culling",
    "landing.starting": "Starting...",
    "landing.onlyJpgSupported": "Warning: Only JPG/JPEG photos are supported. Other files in the folder will be ignored.",
    "landing.noJpgFound": "No JPG photos found in the selected folders.",

    // Processing
    "processing.title": "Analyzing Photos...",
    "processing.scanning": "Scanning folders",
    "processing.technical": "Technical Analysis",
    "processing.duplicates": "Duplicate Detection",
    "processing.complete": "Analysis Complete!",
    "processing.cancelled": "Analysis Cancelled",
    "processing.error": "Analysis Error",
    "processing.failed": "Analysis Failed",
    "processing.cancel": "Cancel",
    "processing.cancelling": "Cancelling...",
    "processing.retry": "Retry",
    "processing.back": "Back",
    "processing.elapsed": "Elapsed",

    // Review
    "review.keep": "Keep",
    "review.maybe": "Maybe",
    "review.reject": "Reject",
    "review.sortBy": "Sort",
    "review.qualityScore": "Quality Score",
    "review.filename": "Filename",
    "review.selected": "selected",
    "review.moveToKeep": "Move to Keep",
    "review.moveToMaybe": "Move to Maybe",
    "review.moveToReject": "Move to Reject",
    "review.clearSelection": "Clear",
    "review.export": "Export",
    "review.noPhotos": "No photos in this category",
    "review.resetOriginal": "Reset to Original",
    "review.photoDetails": "Photo Details",
    "review.photosTotal": "photos total",
    "review.zoomHint": "Click to zoom",

    // Detail
    "detail.quality": "Quality Score",
    "detail.sharpness": "Sharpness",
    "detail.exposure": "Exposure",
    "detail.contrast": "Contrast",
    "detail.exifScore": "EXIF Score",
    "detail.fileSize": "File Size",

    // Groups
    "group.badge_tooltip": "This photo is part of a group of similar shots. Click to review the group.",
    "group.title": "Photo Group",
    "group.auto_pick": "Auto pick",
    "group.view": "View group (×{n})",
    "group.keep_this_reject_rest": "Keep this, reject the rest",
    "group.kind_duplicate": "Duplicates",
    "group.kind_similar": "Similar shots",
    "group.members": "{n} photos in this group",
    "group.compare": "Compare",

    // Compare
    "compare.title": "Compare",
    "compare.open": "Compare",
    "compare.keep_this": "Keep this, reject others",
    "compare.hint": "Scroll to zoom · drag to pan · double-click to reset · Esc to close",
    "compare.auto_pick": "Auto pick",
    "compare.needs_selection": "Select 2-4 photos to compare",

    // Filter
    "filter.button": "Filter",
    "filter.title": "Filters",
    "filter.scoreRange": "Score range",
    "filter.isoRange": "ISO range",
    "filter.min": "Min",
    "filter.max": "Max",
    "filter.rejectReason": "Reject reason",
    "filter.anyReason": "Any reason",
    "filter.mismatch": "Disagrees with engine",
    "filter.clear": "Clear",
    "filter.noMatches": "No photos match the current filters",
    "filter.reason_blurry": "Blurry",
    "filter.reason_dark": "Dark",
    "filter.reason_overexposed": "Overexposed",
    "filter.reason_duplicate": "Duplicate",
    "filter.reason_similar": "Similar",
    "filter.reason_reject": "Manual reject",

    // Export
    "export.title": "Export Photos",
    "export.summary": "Summary",
    "export.outputFolder": "Output folder",
    "export.outputDefault": "Default location",
    "export.filesOrganized": "files will be organized",
    "export.exporting": "Exporting...",
    "export.complete": "Export Complete",
    "export.completeDesc": "All photos have been organized and exported.",
    "export.openFolder": "Open Folder",
    "export.backToReview": "Back to Review",
    "export.start": "Export Photos",
    "export.error": "Export Failed",
    "export.back": "Back",
    "export.retry": "Retry",

    // Update
    "update.available": "A new version is available!",
    "update.install": "Update Now",
    "update.later": "Later",
    "update.downloading": "Downloading update...",
  },
  tr: {
    // Landing
    "app.title": "FYF Fotograf Eleme",
    "app.subtitle": "AI destekli fotograf eleme ve duzenleme",
    "landing.selectFolders": "Klasor Sec",
    "landing.selectOutput": "Cikti Klasoru Sec",
    "landing.mergeMode": "Tumunu tek output'a birlestir",
    "landing.startCulling": "Elemeye Basla",
    "landing.starting": "Baslatiliyor...",
    "landing.onlyJpgSupported": "Uyarı: Sadece JPG/JPEG fotoğrafları desteklenmektedir. Diğer dosyalar göz ardı edilecektir.",
    "landing.noJpgFound": "Seçilen klasörlerde hiç JPG fotoğraf bulunamadı.",

    // Processing
    "processing.title": "Fotograflar Analiz Ediliyor...",
    "processing.scanning": "Klasorler taraniyor",
    "processing.technical": "Teknik Analiz",
    "processing.duplicates": "Kopya Tespiti",
    "processing.complete": "Analiz Tamamlandi!",
    "processing.cancelled": "Analiz Iptal Edildi",
    "processing.error": "Analiz Hatasi",
    "processing.failed": "Analiz Basarisiz",
    "processing.cancel": "Iptal",
    "processing.cancelling": "Iptal ediliyor...",
    "processing.retry": "Tekrar Dene",
    "processing.back": "Geri",
    "processing.elapsed": "Gecen Sure",

    // Review
    "review.keep": "Tut",
    "review.maybe": "Belki",
    "review.reject": "Reddet",
    "review.sortBy": "Siralama",
    "review.qualityScore": "Kalite Puani",
    "review.filename": "Dosya Adi",
    "review.selected": "secili",
    "review.moveToKeep": "Tut'a Tasi",
    "review.moveToMaybe": "Belki'ye Tasi",
    "review.moveToReject": "Reddet'e Tasi",
    "review.clearSelection": "Temizle",
    "review.export": "Disa Aktar",
    "review.noPhotos": "Bu kategoride fotograf yok",
    "review.resetOriginal": "Orijinale Sifirla",
    "review.photoDetails": "Fotograf Detaylari",
    "review.photosTotal": "toplam fotograf",
    "review.zoomHint": "Yakınlaştırmak için tıkla",

    // Detail
    "detail.quality": "Kalite Puani",
    "detail.sharpness": "Keskinlik",
    "detail.exposure": "Pozlama",
    "detail.contrast": "Kontrast",
    "detail.exifScore": "EXIF Puani",
    "detail.fileSize": "Dosya Boyutu",

    // Groups
    "group.badge_tooltip": "Bu fotoğraf benzer karelerden oluşan bir grubun parçası. Grubu incelemek için tıklayın.",
    "group.title": "Fotoğraf Grubu",
    "group.auto_pick": "Otomatik seçim",
    "group.view": "Grubu görüntüle (×{n})",
    "group.keep_this_reject_rest": "Bunu tut, kalanları reddet",
    "group.kind_duplicate": "Kopyalar",
    "group.kind_similar": "Benzer kareler",
    "group.members": "Bu grupta {n} fotoğraf",
    "group.compare": "Karşılaştır",

    // Compare
    "compare.title": "Karşılaştır",
    "compare.open": "Karşılaştır",
    "compare.keep_this": "Bunu tut, diğerlerini reddet",
    "compare.hint": "Yakınlaştırmak için kaydır · sürükleyerek gezin · sıfırlamak için çift tıkla · kapatmak için Esc",
    "compare.auto_pick": "Otomatik seçim",
    "compare.needs_selection": "Karşılaştırmak için 2-4 fotoğraf seçin",

    // Filter
    "filter.button": "Filtre",
    "filter.title": "Filtreler",
    "filter.scoreRange": "Puan aralığı",
    "filter.isoRange": "ISO aralığı",
    "filter.min": "Min",
    "filter.max": "Maks",
    "filter.rejectReason": "Reddetme sebebi",
    "filter.anyReason": "Tüm sebepler",
    "filter.mismatch": "Motorla çelişenler",
    "filter.clear": "Temizle",
    "filter.noMatches": "Mevcut filtrelerle eşleşen fotoğraf yok",
    "filter.reason_blurry": "Bulanık",
    "filter.reason_dark": "Karanlık",
    "filter.reason_overexposed": "Aşırı pozlanmış",
    "filter.reason_duplicate": "Kopya",
    "filter.reason_similar": "Benzer",
    "filter.reason_reject": "Manuel reddedilen",

    // Export
    "export.title": "Fotograflari Disa Aktar",
    "export.summary": "Ozet",
    "export.outputFolder": "Cikti klasoru",
    "export.outputDefault": "Varsayilan konum",
    "export.filesOrganized": "dosya duzenlenecek",
    "export.exporting": "Disa aktariliyor...",
    "export.complete": "Disa Aktarma Tamamlandi!",
    "export.completeDesc":
      "Tum fotograflar duzenlendi ve disa aktarildi.",
    "export.openFolder": "Klasörü Aç",
    "export.backToReview": "Incelemeye Don",
    "export.start": "Disa Aktar",
    "export.error": "Disa Aktarma Hatasi",
    "export.back": "Geri",
    "export.retry": "Tekrar Dene",

    // Update
    "update.available": "Yeni versiyon mevcut!",
    "update.install": "Güncelle",
    "update.later": "Sonra",
    "update.downloading": "Güncelleme indiriliyor...",
  },
} as const;

type TranslationKey = keyof (typeof translations)["en"];

let currentLocale: Locale = "en";
const listeners = new Set<() => void>();

export function setLocale(locale: Locale) {
  currentLocale = locale;
  localStorage.setItem("fyf-locale", locale);
  listeners.forEach((fn) => fn());
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let str: string = translations[currentLocale][key] || translations.en[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      str = str.replace(`{${name}}`, String(value));
    }
  }
  return str;
}

// Initialize from localStorage
const saved = localStorage.getItem("fyf-locale") as Locale | null;
if (saved && (saved === "en" || saved === "tr")) {
  currentLocale = saved;
}

// React hook
export function useLocale(): {
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
} {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => currentLocale,
  );
  return { locale: currentLocale, t, setLocale };
}
