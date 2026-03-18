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

    // Detail
    "detail.quality": "Quality Score",
    "detail.sharpness": "Sharpness",
    "detail.exposure": "Exposure",
    "detail.contrast": "Contrast",
    "detail.exifScore": "EXIF Score",
    "detail.fileSize": "File Size",

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
    "update.available": "A new version is available:",
    "update.install": "Update Now",
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

    // Detail
    "detail.quality": "Kalite Puani",
    "detail.sharpness": "Keskinlik",
    "detail.exposure": "Pozlama",
    "detail.contrast": "Kontrast",
    "detail.exifScore": "EXIF Puani",
    "detail.fileSize": "Dosya Boyutu",

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
    "update.available": "Yeni versiyon mevcut:",
    "update.install": "Güncelle",
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

export function t(key: TranslationKey): string {
  return translations[currentLocale][key] || translations.en[key] || key;
}

// Initialize from localStorage
const saved = localStorage.getItem("fyf-locale") as Locale | null;
if (saved && (saved === "en" || saved === "tr")) {
  currentLocale = saved;
}

// React hook
export function useLocale(): {
  locale: Locale;
  t: (key: TranslationKey) => string;
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
