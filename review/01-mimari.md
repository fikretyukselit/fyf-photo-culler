# 01 — Mimari Değerlendirme

> **Durum (2026-07-12):** ✅ port keşfi zinciri tamamlandı + timeout/stderr log (F0.3) · ✅ CORS localhost'a daraltıldı · ✅ sidecar child hemen izleniyor. **Açık:** üç-dilli stack / Rust'a taşıma değerlendirmesi, PyInstaller onefile açılış gecikmesi (`--onedir`), thumbnail cache'in platform dizinine taşınması (app-data helper eklendi, thumbnail henüz taşınmadı), sidecar HTTP'sine token.

## Mevcut Mimari

```
Tauri (Rust kabuk)
  └─ sidecar spawn → PyInstaller ile paketlenmiş Python FastAPI (127.0.0.1, port 9470-9490)
       └─ culling/ (OpenCV, imagehash, scikit-image)
  └─ WebView → React + TypeScript + Zustand + Tailwind/shadcn
       └─ REST + SSE ile backend'e bağlanır
```

Veri akışı: Tauri sidecar'ı başlatır → backend stdout'a `BACKEND_PORT=xxxx` yazar → Rust bunu yakalayıp state'e koyar → frontend REST/SSE ile konuşur.

## Doğru Yapılanlar

- **Katman ayrımı temiz**: analiz motoru (`culling/`) backend'den bağımsız, saf Python; test edilebilir ve CLI'dan da kullanılabilir durumda.
- **SSE ile ilerleme akışı** doğru araç seçimi (WebSocket karmaşasına girilmemiş).
- **Sanal grid** (`@tanstack/react-virtual`) — binlerce fotoğraf hedefi için doğru temel.
- **Sidecar yaşam döngüsü düşünülmüş**: pencere kapanınca child kill ediliyor (`ui/src-tauri/src/lib.rs:100-111`), dev ortamında `python3 -m backend.server` fallback'i var.

## Sorunlu Trade-off'lar

### 1. Üç dilli stack (Rust + Python + TypeScript) — gönüllü projesi için ağır

Python tercihi anlaşılır (OpenCV/imagehash ekosistemi), ama bedeli:

| Boyut | Etki |
|---|---|
| Binary boyutu | Sidecar ~160 MB (yerel `binaries/fyf-backend-aarch64-apple-darwin` 162 MB) |
| Açılış süresi | PyInstaller `--onefile` her açılışta geçici dizine açılır: 5-10 sn donuk ekran |
| Antivirüs | PyInstaller onefile + UPX (`fyf-backend.spec`) Windows Defender'da yaygın false-positive kaynağı |
| Bakım | Katkıcının 3 dil + PyInstaller + Tauri bilmesi gerekir |

Kısa vadede pragmatik; uzun vadede analizin Rust'a (`image`, `imageproc`, `img_hash` crate'leri) taşınması hem sidecar'ı hem PyInstaller'ı hem de port-keşif mekanizmasını tamamen ortadan kaldırır. Mevcut algoritmalar (Laplacian varyansı, pHash, ORB yerine basit blok eşleme) Rust'ta makul eforla yazılabilir.

### 2. Port keşfi kırılgan ve yarım bırakılmış

- Rust tarafı portu yakalayıp `get_backend_port` komutuyla sunuyor (`lib.rs:11-15`) ama **frontend bu komutu hiç çağırmıyor** (`App.tsx:101-104` her zaman `backendPort ?? 9470`, store'daki `backendPort` hiç set edilmiyor). Sistem, backend'in `find_free_port(start=9470)` ile ilk denemede 9470'i alması sayesinde çalışıyor.
- Sidecar port satırını basamadan ölürse timeout yok; kullanıcı sonsuz "Backend not ready" görür (`lib.rs:43-56`).
- Dev fallback'te `std::mem::forget(child)` (`lib.rs:88`) — geliştirmede her kapanışta yetim Python süreci kalır; sidecar yolunda da child ancak port satırı görüldükten sonra state'e yazıldığı için (`lib.rs:51`) erken ölümde takip kaybolur.
- Sidecar stderr'i hiç okunmuyor — backend çökme sebebi kaybolur.

**Öneri:** Frontend açılışta `invoke("get_backend_port")` çağırsın (retry + timeout ile); Rust tarafına 5 sn'lik port bekleme timeout'u ve stderr loglaması eklensin; child spawn edilir edilmez state'e konsun.

### 3. Sidecar HTTP'si kimliksiz

Aynı makinedeki herhangi bir süreç (veya CORS `*` + `allow_credentials` kombinasyonuyla tarayıcı üzerinden DNS-rebinding senaryoları) API'ye erişebilir. Masaüstü tek kullanıcı senaryosunda risk düşük ama maliyeti de düşük bir önlem var: Tauri başlangıçta rastgele bir token üretsin, sidecar'a env ile geçsin, her istekte `X-Auth-Token` doğrulansın. Detay: [03-backend.md](03-backend.md).

### 4. `.thumbnails/` çalışma dizinine yazılıyor

`SessionState.thumbnail_cache_dir = ".thumbnails"` (`backend/state.py`) — CWD'ye göre değişir; geliştirmede repo köküne yazıyor (şu an kökte 370+ jpg var), üretimde uygulamanın nereden başlatıldığına göre öngörülemez. `platformdirs` ile OS'un cache dizini (`~/Library/Caches/fyf-photo`, `%LOCALAPPDATA%`) kullanılmalı; ayrıca boyut sınırı/temizlik politikası yok.

## Mimari Karar Önerisi

v0.x boyunca mevcut mimariyle devam edilebilir; ancak 1.0 hedefi "teknik olmayan kullanıcıya dağıtım" ise açılış süresi + antivirüs + imzasız binary üçlüsü asıl engel. İki seçenek:

- **A (düşük efor):** PyInstaller `--onedir`'e geç (açılış 5-10 sn → ~1 sn), UPX'i kapat, imzalama ekle. 3 dilli stack kalır.
- **B (yüksek efor, kalıcı çözüm):** Analizi Rust'a taşı, sidecar'ı tamamen kaldır. ~20-30 MB tek binary, <1 sn açılış, antivirüs sorunu biter.

Öneri: 0.2'de A, 1.0 yolunda B'yi değerlendir.
