import { useSyncExternalStore } from "react";
import { workspaceCopy } from "./workspace-copy";

export type Locale = "en" | "tr";

const translations = {
  en: {
    ...workspaceCopy.en,
    // Landing
    "app.title": "FYF Photo Culler",
    "app.subtitle": "AI-powered photo culling and organization",
    "landing.selectFolders": "Select Folders",
    "landing.selectOutput": "Select Output Folder",
    "landing.mergeMode": "Merge all into single output",
    "landing.startCulling": "Start Culling",
    "landing.starting": "Starting...",
    "landing.onlyJpgSupported":
      "Warning: {n} unsupported image file(s) (RAW, PNG, HEIC…) will be skipped — only JPG/JPEG is analyzed. Continue?",
    "landing.noJpgFound":
      "No JPG photos found in the selected folders (subfolders are searched too).",

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
    "detail.focusUncertain":
      "Sharp detail is limited to one region. Check the subject’s focus before deciding.",
    "detail.exposure": "Exposure",
    "detail.contrast": "Contrast",
    "detail.exifScore": "EXIF Score",
    "detail.fileSize": "File Size",

    // Groups
    "group.badge_tooltip":
      "This photo is part of a group of similar shots. Click to review the group.",
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
    "compare.hint":
      "Scroll to zoom · drag to pan · double-click to reset · Esc to close",
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
    "update.installing": "Installing update...",
    "update.restarting": "Restarting app...",
    "update.installed": "Update installed",
    "update.failed": "The update could not be installed.",
    "update.restartFailed": "Automatic restart failed.",
    "update.retry": "Retry update",
    "update.restart": "Restart app",
    "update.restartHint": "The update is installed. Close and reopen the app, or retry restarting.",

    // Backend connection
    "backend.connecting": "Connecting to the analysis engine...",
    "backend.errorTitle": "Couldn't reach the analysis engine",
    "backend.errorHint":
      "The background process didn't start in time. This can happen if the port is in use or another copy of the app is running. Try again, or restart the app.",
    "backend.retry": "Retry",

    // Session resume
    "session.resumeTitle": "Resume your previous session?",
    "session.resumeHint":
      "{total} photos, {keep} in Keep. Your decisions are saved.",
    "session.resume": "Resume",
    "session.discard": "Discard",

    // Undo / redo
    "history.undo": "Undo (Ctrl/Cmd+Z)",
    "history.redo": "Redo (Ctrl/Cmd+Shift+Z)",

    // Folder (SD card) filter
    "folder.all": "All folders",

    // Grid / triage
    "review.densityTitle": "Thumbnail size",
    "review.loading": "Loading photos…",
    "triage.failed": "Couldn't save — change reverted",

    // Loupe
    "loupe.zoomHint": "Z or click to zoom",
    "loupe.close": "Close (Esc)",
    "detail.openLoupe": "Large view (Enter)",
    "detail.prev": "Previous (←)",
    "detail.next": "Next (→)",
    "detail.position": "{i} of {n}",

    // Shortcuts overlay
    "shortcuts.title": "Keyboard Shortcuts",
    "shortcuts.hint": "? shortcuts",
    "shortcuts.navigate": "Move focus",
    "shortcuts.triage": "Keep / Maybe / Reject (focused or selected)",
    "shortcuts.select": "Select / deselect focused photo",
    "shortcuts.loupe": "Open large view",
    "shortcuts.selectAll": "Select all loaded photos",
    "shortcuts.compare": "Compare selected (2–4)",
    "shortcuts.zoom": "Zoom in large view",
    "shortcuts.undoRedo": "Undo / Redo",
    "shortcuts.close": "Close / clear selection",

    // Onboarding tour
    "onboarding.skip": "Skip",
    "onboarding.next": "Next",
    "onboarding.start": "Let's start",
    "onboarding.replay": "How it works",
    "onboarding.s1.title": "Load your SD cards",
    "onboarding.s1.caption":
      "Pick one or more folders — subfolders are scanned too.",
    "onboarding.s2.title": "AI scores every shot",
    "onboarding.s2.caption":
      "Sharpness, exposure and duplicates are analyzed automatically.",
    "onboarding.s3.title": "Cull at the speed of keys",
    "onboarding.s3.caption":
      "Enter opens the viewer · K keep · M maybe · R reject — it auto-advances.",
    "onboarding.s4.title": "Export, organized",
    "onboarding.s4.caption":
      "Keep, Maybe and Reject land in tidy folders, ready for Lightroom.",
  },
  tr: {
    ...workspaceCopy.tr,
    // Landing
    "app.title": "FYF Fotoğraf Eleme",
    "app.subtitle": "Akıllı fotoğraf eleme ve düzenleme",
    "landing.selectFolders": "Klasör seç",
    "landing.selectOutput": "Çıktı klasörü seç",
    "landing.mergeMode": "Tüm kartları tek çıktıda birleştir",
    "landing.startCulling": "Elemeye başla",
    "landing.starting": "Başlatılıyor…",
    "landing.onlyJpgSupported":
      "Uyarı: {n} desteklenmeyen görüntü dosyası (RAW, PNG, HEIC…) atlanacak — yalnızca JPG/JPEG analiz edilir. Devam edilsin mi?",
    "landing.noJpgFound":
      "Seçilen klasörlerde hiç JPG fotoğraf bulunamadı (alt klasörler de tarandı).",

    // Processing
    "processing.title": "Fotoğraflar analiz ediliyor…",
    "processing.scanning": "Klasörler taranıyor",
    "processing.technical": "Teknik analiz",
    "processing.duplicates": "Kopya tespiti",
    "processing.complete": "Analiz tamamlandı",
    "processing.cancelled": "Analiz iptal edildi",
    "processing.error": "Analiz hatası",
    "processing.failed": "Analiz başarısız",
    "processing.cancel": "İptal et",
    "processing.cancelling": "İptal ediliyor…",
    "processing.retry": "Tekrar dene",
    "processing.back": "Geri",
    "processing.elapsed": "Geçen süre",

    // Review
    "review.keep": "Tut",
    "review.maybe": "Belki",
    "review.reject": "Reddet",
    "review.sortBy": "Sıralama",
    "review.qualityScore": "Kalite puanı",
    "review.filename": "Dosya adı",
    "review.selected": "seçili",
    "review.moveToKeep": "Tut kategorisine taşı",
    "review.moveToMaybe": "Belki kategorisine taşı",
    "review.moveToReject": "Reddet kategorisine taşı",
    "review.clearSelection": "Temizle",
    "review.export": "Dışa aktar",
    "review.noPhotos": "Bu kategoride fotoğraf yok",
    "review.resetOriginal": "Analiz önerisine dön",
    "review.photoDetails": "Fotoğraf detayları",
    "review.photosTotal": "toplam fotoğraf",
    "review.zoomHint": "Yakınlaştırmak için tıkla",

    // Detail
    "detail.quality": "Kalite puanı",
    "detail.sharpness": "Keskinlik",
    "detail.focusUncertain":
      "Net ayrıntılar tek bir bölgede yoğunlaşıyor. Karar vermeden önce ana konunun netliğini kontrol et.",
    "detail.exposure": "Pozlama",
    "detail.contrast": "Kontrast",
    "detail.exifScore": "EXIF puanı",
    "detail.fileSize": "Dosya boyutu",

    // Groups
    "group.badge_tooltip":
      "Bu fotoğraf benzer karelerden oluşan bir grubun parçası. Grubu incelemek için tıkla.",
    "group.title": "Fotoğraf grubu",
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
    "compare.hint":
      "Yakınlaştırmak için kaydır · sürükleyerek gezin · sıfırlamak için çift tıkla · kapatmak için Esc",
    "compare.auto_pick": "Otomatik seçim",
    "compare.needs_selection": "Karşılaştırmak için 2–4 fotoğraf seç",

    // Filter
    "filter.button": "Filtre",
    "filter.title": "Filtreler",
    "filter.scoreRange": "Puan aralığı",
    "filter.isoRange": "ISO aralığı",
    "filter.min": "Min",
    "filter.max": "Maks",
    "filter.rejectReason": "Reddetme sebebi",
    "filter.anyReason": "Tüm sebepler",
    "filter.mismatch": "Analizden farklı kararlar",
    "filter.clear": "Temizle",
    "filter.noMatches": "Mevcut filtrelerle eşleşen fotoğraf yok",
    "filter.reason_blurry": "Bulanık",
    "filter.reason_dark": "Karanlık",
    "filter.reason_overexposed": "Aşırı pozlanmış",
    "filter.reason_duplicate": "Kopya",
    "filter.reason_similar": "Benzer",
    "filter.reason_reject": "Manuel reddedilen",

    // Export
    "export.title": "Fotoğrafları dışa aktar",
    "export.summary": "Özet",
    "export.outputFolder": "Çıktı klasörü",
    "export.outputDefault": "Varsayılan konum",
    "export.filesOrganized": "dosya düzenlenecek",
    "export.exporting": "Dışa aktarılıyor…",
    "export.complete": "Dışa aktarma tamamlandı",
    "export.completeDesc":
      "Fotoğrafların düzenlendi ve hedef klasöre kopyalandı.",
    "export.openFolder": "Klasörü aç",
    "export.backToReview": "İncelemeye dön",
    "export.start": "Dışa aktar",
    "export.error": "Dışa aktarma hatası",
    "export.back": "Geri",
    "export.retry": "Tekrar dene",

    // Update
    "update.available": "Yeni versiyon mevcut!",
    "update.install": "Güncelle",
    "update.later": "Sonra",
    "update.downloading": "Güncelleme indiriliyor...",
    "update.installing": "Güncelleme kuruluyor...",
    "update.restarting": "Uygulama yeniden başlatılıyor...",
    "update.installed": "Güncelleme kuruldu",
    "update.failed": "Güncelleme kurulamadı.",
    "update.restartFailed": "Otomatik yeniden başlatma başarısız.",
    "update.retry": "Tekrar dene",
    "update.restart": "Yeniden başlat",
    "update.restartHint": "Güncelleme kuruldu. Uygulamayı kapatıp açabilir veya yeniden başlatmayı tekrar deneyebilirsin.",

    // Backend connection
    "backend.connecting": "Analiz motoruna bağlanılıyor...",
    "backend.errorTitle": "Analiz motoruna ulaşılamadı",
    "backend.errorHint":
      "Arka plan süreci zamanında başlamadı. Port kullanımdaysa veya uygulamanın başka bir kopyası açıksa bu olabilir. Tekrar deneyin ya da uygulamayı yeniden başlatın.",
    "backend.retry": "Tekrar dene",

    // Session resume
    "session.resumeTitle": "Kaldığın yerden devam et",
    "session.resumeHint":
      "{total} fotoğraf, {keep} tutulan. Kararların kayıtlı.",
    "session.resume": "Devam et",
    "session.discard": "Sil",

    // Undo / redo
    "history.undo": "Geri al (Ctrl/Cmd+Z)",
    "history.redo": "Yinele (Ctrl/Cmd+Shift+Z)",

    // Folder (SD card) filter
    "folder.all": "Tüm klasörler",

    // Grid / triage
    "review.densityTitle": "Küçük resim boyutu",
    "review.loading": "Fotoğraflar yükleniyor…",
    "triage.failed": "Kaydedilemedi — değişiklik geri alındı",

    // Loupe
    "loupe.zoomHint": "Yakınlaştırmak için Z veya tıkla",
    "loupe.close": "Kapat (Esc)",
    "detail.openLoupe": "Büyük görünüm (Enter)",
    "detail.prev": "Önceki (←)",
    "detail.next": "Sonraki (→)",
    "detail.position": "{i} / {n}",

    // Shortcuts overlay
    "shortcuts.title": "Klavye kısayolları",
    "shortcuts.hint": "? kısayollar",
    "shortcuts.navigate": "Odağı taşı",
    "shortcuts.triage": "Tut / Belki / Reddet (odaktaki veya seçili)",
    "shortcuts.select": "Odaktaki fotoğrafı seç / bırak",
    "shortcuts.loupe": "Büyük görünümü aç",
    "shortcuts.selectAll": "Yüklenen fotoğrafların tümünü seç",
    "shortcuts.compare": "Seçilenleri karşılaştır (2–4)",
    "shortcuts.zoom": "Büyük görünümde yakınlaştır",
    "shortcuts.undoRedo": "Geri al / Yinele",
    "shortcuts.close": "Kapat / seçimi temizle",

    // Onboarding tour
    "onboarding.skip": "Geç",
    "onboarding.next": "İleri",
    "onboarding.start": "Başlayalım",
    "onboarding.replay": "Nasıl çalışır?",
    "onboarding.s1.title": "SD kartlarını yükle",
    "onboarding.s1.caption":
      "Bir veya birden çok klasör seç — alt klasörler de taranır.",
    "onboarding.s2.title": "AI her kareyi puanlar",
    "onboarding.s2.caption":
      "Keskinlik, pozlama ve kopyalar otomatik analiz edilir.",
    "onboarding.s3.title": "Klavye hızında ele",
    "onboarding.s3.caption":
      "Enter büyük görünümü açar · K tut · M belki · R reddet — otomatik ilerler.",
    "onboarding.s4.title": "Düzenlenmiş şekilde dışa aktar",
    "onboarding.s4.caption":
      "Tut, Belki ve Reddet düzenli klasörlere ayrılır — Lightroom'a hazır.",
  },
} as const;

type TranslationKey = keyof (typeof translations)["en"];

let currentLocale: Locale = "en";
const listeners = new Set<() => void>();

export function setLocale(locale: Locale) {
  currentLocale = locale;
  document.documentElement.lang = locale;
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
  let str: string =
    translations[currentLocale][key] || translations.en[key] || key;
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

document.documentElement.lang = currentLocale;

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
