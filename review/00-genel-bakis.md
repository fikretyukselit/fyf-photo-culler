# FYF Photo Culler — Kapsamlı Proje İncelemesi

> Tarih: 2026-07-12 · İncelenen sürüm: v0.1.3 (commit `3256fbb`)
> Yöntem: Tüm kaynak kod okundu; 4 paralel derin analiz (motor, backend, frontend, build/CI) + kritik bulguların kod üzerinde elle doğrulanması.

## Projenin Amacı

FRC (FIRST Robotics Competition) medya ekipleri bir yarışma gününde yüzlerce–binlerce fotoğraf çeker. Bunların elle ayıklanması (culling) saatler sürer. FYF Photo Culler bu süreci otomatikleştirir:

1. **Teknik kalite analizi** — keskinlik, pozlama, kontrast ve EXIF verisinden 0–100 arası skor
2. **Duplicate/burst tespiti** — pHash + SSIM ile birebir kopyalar, pHash + ORB ile seri çekimler; her gruptan "en iyi" kare tutulur
3. **Otomatik kategorizasyon** — Keep / Maybe / Reject (blurry, dark, overexposed, duplicate, similar alt sebepleriyle)
4. **Manuel review** — sanal (virtualized) galeri, klavye kısayolları, toplu işlem
5. **Export** — organize klasör yapısına kopyalama

Fikret Yüksel Foundation gönüllüleri tarafından geliştirilen açık kaynak, çapraz platform (macOS/Windows/Linux) bir masaüstü uygulaması.

## Çözdüğü Problem Gerçek mi?

Evet. Spor/etkinlik fotoğrafçılığında culling, toplam iş yükünün en büyük kalemlerinden biridir; Photo Mechanic ve Lightroom gibi profesyonel araçlar pahalı ve gönüllü ekipler için öğrenme eğrisi yüksek. "FRC'ye özel, ücretsiz, tek tuşla ön eleme" değer önerisi sağlam. Kodda alan bilgisi de görünüyor (karanlık arena toleransı, sığ alan derinliği farkındalığı).

## Genel Değerlendirme

| Boyut | Not | Özet |
|---|---|---|
| Amaç / problem uyumu | ★★★★★ | Gerçek bir acıya isabetli çözüm |
| Mimari | ★★★☆☆ | Pragmatik ama 3 dilli stack + sidecar maliyeti yüksek ([01](01-mimari.md)) |
| Analiz motoru | ★★☆☆☆ | Alan bilgisi iyi, ama kalibre edilmemiş sabitler ve EXIF rotasyon körlüğü gibi temel hatalar ([02](02-analiz-motoru.md)) |
| Backend | ★★★☆☆ | Temiz API, ama kalıcılık yok: çökme = saatlerce review kaybı ([03](03-backend.md)) |
| Frontend/UX | ★★★☆☆ | Modern ve hızlı grid; ama culling'in kalbi olan karşılaştırma/undo/filtre yok ([04](04-frontend-ux.md)) |
| Build & Release | ★★★☆☆ | Ciddi CI altyapısı var; test/lint çalışmıyor, imzalama yok ([05](05-build-release.md)) |

## En Kritik 10 Bulgu (öncelik sırasıyla)

1. **Port keşfi frontend'de hiç kullanılmıyor** — `get_backend_port` Rust komutu var ama frontend hiç çağırmıyor; her zaman 9470 fallback'i kullanılıyor (`ui/src/App.tsx:101-104`, `stores.ts:67`'deki `setBackendPort` ölü kod). Uygulama, backend'in de 9470'ten başlaması sayesinde *tesadüfen* çalışıyor. 9470 doluysa (ikinci kopya, başka uygulama) uygulama sessizce bağlanamaz. **Doğrulandı.**
2. **EXIF rotasyonu tamamen yok sayılıyor** — tüm yükleme `cv2.imread` ile (`culling/utils.py:18`); OpenCV orientation tag'ini uygulamaz. Döndürülmüş kopyalar duplicate olarak yakalanamaz, keskinlik/pozlama tutarsızlaşır. **Doğrulandı.**
3. **In-memory state, sıfır kalıcılık** — analiz sonuçları ve kullanıcının tüm review kararları RAM'de (`backend/state.py:27`). Backend çökerse veya uygulama kapanırsa saatlerce emek kaybolur. ([03](03-backend.md), [06](06-iyi-niyet-yanlis-tasarim.md))
4. **Alt klasörler sessizce atlanıyor** — `list_jpeg_files` non-recursive ve yalnızca `.jpg/.jpeg` (`culling/utils.py:59-70`). SD karttaki `DCIM/100CANON/...` yapısı, PNG/HEIC/RAW dosyaları görünmeden elenir; kullanıcıya uyarı yok. **Doğrulandı.**
5. **Multi-folder export'ta `startswith` hatası** — `photos` ve `photos-backup` gibi ön eki ortak klasörlerde dosyalar yanlış klasöre yazılır (`backend/routes/export.py:59,67`); ayrıca ilerleme sayacı O(n²). **Doğrulandı.**
6. **Keskinlik skoru kalibre edilemez** — 1024px'e küçültülmüş görüntü üzerinde Laplacian varyansı + belgesiz `500` sabiti (`culling/technical.py:99,139`). Eşikler (85/50) bu küçültmeye özel; çözünürlük değişirse anlamsızlaşır. **Doğrulandı.**
7. **Burst'ten "en iyi"yi makine seçip gerisini reddediyor** — `(quality_score, file_size)` maksimumu (`culling/duplicates.py:122-123`). Kompozisyon/an bilgisi yok; fotoğrafçının isteyeceği kareler otomatik reject'e düşüyor. Culling aracında en tehlikeli hata türü: **sessiz iyi-kare kaybı.** ([06](06-iyi-niyet-yanlis-tasarim.md))
8. **Undo ve karşılaştırma görünümü yok** — yanlışlıkla 50 fotoğrafı reject'e taşımanın geri dönüşü yok; burst içinden seçim için yan yana karşılaştırma yok. Culling iş akışının iki temel taşı eksik. ([04](04-frontend-ux.md))
9. **CI'da hiçbir test/lint/typecheck koşmuyor** — testler var (`tests/test_technical.py`) ama release workflow'u çalıştırmıyor; `tsc --noEmit` bile yok. Sürüm numarası 4 yerde, `pyproject.toml` 1.0.0 ile uyumsuz. ([05](05-build-release.md))
10. **macOS imzalama/notarizasyon yok + CORS `allow_origins=["*"]`** — Gatekeeper uyarısı kullanıcı kaybettirir; herkese açık CORS localhost dosya servisi ile birleşince gereksiz saldırı yüzeyi. ([03](03-backend.md), [05](05-build-release.md))

## Doküman Haritası

| Dosya | İçerik |
|---|---|
| [01-mimari.md](01-mimari.md) | Mimari değerlendirme, sidecar/3-dil trade-off'ları |
| [02-analiz-motoru.md](02-analiz-motoru.md) | `culling/` — algoritma hataları, kalibrasyon, performans |
| [03-backend.md](03-backend.md) | FastAPI — state, SSE, export, güvenlik |
| [04-frontend-ux.md](04-frontend-ux.md) | React/Tauri — buglar ve culling ergonomisi |
| [05-build-release.md](05-build-release.md) | CI/CD, paketleme, sürümleme, repo hijyeni |
| [06-iyi-niyet-yanlis-tasarim.md](06-iyi-niyet-yanlis-tasarim.md) | **İyi amaçla yapılmış ama yanlış düşünülmüş kararlar** |
| [07-ozellik-yol-haritasi.md](07-ozellik-yol-haritasi.md) | Önerilen yeni özellikler ve fazlı yol haritası |
