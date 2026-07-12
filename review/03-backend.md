# 03 — Backend (`backend/`, FastAPI sidecar)

> **Durum (2026-07-12):** ✅ 3.1 kalıcılık (F0.1: `persistence.py` + oturum devam) · ✅ CORS `*` → localhost allowlist (D) · ✅ undo/redo + session endpoint'leri eklendi. **Açık:** 3.2 multi-folder `startswith` hatası, 3.3 export SSE hata yakalama, 3.4 analiz yeniden-başlatma yarışı, 3.5 SSE tamamlanma protokolü, thumbnail cache'in hâlâ CWD'ye yazması (app-data helper eklendi ama thumbnail taşınmadı).

## API Özeti

| Endpoint | İş |
|---|---|
| `POST /api/analyze` | Daemon thread'de pipeline başlatır |
| `GET /api/progress` (SSE) | 0.5 sn'de bir `state.progress` yayınlar |
| `POST /api/cancel` | İptal bayrağı |
| `GET /api/photos` (sayfalı), `/api/photos/{id}`, `/{id}/thumbnail`, `/{id}/full` | Listeleme + görüntü servisi (id = base64(path)) |
| `POST /api/override`, `/batch`, `/reset`, `/reset-all` | Kullanıcı kararları |
| `GET /api/export/preview`, `GET /api/export` (SSE) | Kopyalayarak dışa aktarım |

Tasarım genel olarak okunaklı ve amaca uygun; override'ların hesaplanan hedeflerden ayrı tutulup sunumda birleştirilmesi (`_effective_destination`) doğru bir desen.

## Kritik Sorunlar

### 3.1 Kalıcılık yok — en pahalı eksik (`state.py:27`)
`SessionState` tamamen RAM'de: analizler, hedefler ve **kullanıcının tüm override'ları**. Backend çökerse (OpenCV segfault, OOM) ya da kullanıcı uygulamayı kapatırsa: analiz yeniden (uzun), review kararları **kalıcı olarak** kayıp. 2000 fotoğrafı gözden geçirmiş bir gönüllü için felaket senaryosu.

**Çözüm:** Her override'da (debounce'lu) `~/.local/share/fyf-photo/session.json`'a yaz; açılışta "Önceki oturuma devam et?" sun. Analiz sonuçları da dosya mtime+size anahtarıyla cache'lenirse yeniden analiz de saniyelere iner.

### 3.2 Multi-folder export `startswith` hatası — `export.py:59,67` ✅ doğrulandı
```python
folder_paths = [p for p in paths if p.startswith(os.path.abspath(folder))]
```
`/foto/kural` ve `/foto/kural-yedek` klasörleri birlikte seçilirse yedek klasörün dosyaları ilk klasörün çıktısına da eşleşir. Ayırıcı eklenerek düzeltilmeli: `folder_abs + os.sep` ile karşılaştır. Ek olarak satır 66-67'deki genel sayaç her dosyada tüm listeyi yeniden tarıyor — O(n²).

### 3.3 Export SSE'sinde hata yakalama yok — `export.py:33-71`
`safe_copy` disk dolu/izin hatası fırlatırsa generator ölür, istemci `onerror` ile sessiz kopma görür; hangi dosyada patladığı kaybolur. Ayrıca `while os.path.exists` + `copy2` deseni (utils.py:81-84) yüzünden **aynı export iki kez çalıştırılırsa** her dosya `_2` kopyasıyla çoğalır. Try/except + `stage: error` mesajı ve "çıktı klasörü boş değil" uyarısı gerekli.

### 3.4 Analiz yeniden başlatma yarışı — `analysis.py`
`is_running` kontrolü lock altında ama eski thread'e ait iptal/tamamlanma penceresinde `state.analyses = {}` sıfırlaması eski thread'in yazacağı sonuçlarla yarışabilir. Basit çözüm: her pipeline'a `analysis_id` ver; thread yalnızca kendi id'si hâlâ aktifse state'e yazsın. İptalde de kısmî sonuçlar korunmalı (şu an teknik analiz bitmiş olsa bile atılıyor).

### 3.5 SSE tamamlanma protokolü örtük — `analysis.py:185-197`
Akış `is_running=False` olunca sessizce kapanıyor; istemci "bitti" ile "koptu"yu ayırt edemiyor (frontend'de de aynı belirsizlik var, bkz. [04](04-frontend-ux.md) 4.2). Kapanmadan önce açık bir `stage: "complete"` (zaten pipeline'da var) + son bir sentinel event garanti edilmeli; frontend yalnızca sentinel görmeden kopmayı hata saymalı.

## Güvenlik

Bağlam: 127.0.0.1'e bağlı, tek kullanıcılı masaüstü yardımcı süreci — tehdit modeli sınırlı, ama iki ucuz düzeltme var:

1. **CORS `allow_origins=["*"]` + `allow_credentials=True`** (`server.py:12-18`): Tarayıcıdan çalışan herhangi bir sayfa (DNS rebinding ile) API'ye istek atabilir; `/api/photos/{id}/full` analiz edilmiş her dosyayı servis eder. Tauri webview origin'i (`tauri://localhost` / `http://localhost:*`) ile sınırla, credentials'ı kapat.
2. **Kimlik doğrulama yok**: Paylaşımlı makinede başka bir yerel kullanıcı portu bulup fotoğrafları çekebilir, analiz tetikleyebilir. Başlangıçta üretilen tek seferlik token yeterli.

Path traversal riski düşük: id'ler base64(path) olsa da `path not in state.analyses` kontrolü (`photos.py`) rastgele dosya okumasını engelliyor. Symlink kanonikleştirme (`os.path.realpath`) eklenirse daha da sağlamlaşır.

## Diğer Bulgular

- **Thumbnail cache CWD'de** (`state.py`, `.thumbnails`): platform cache dizinine taşınmalı; boyut sınırı/temizlik yok. Cache anahtarı `md5(path)` — dosya **içeriği** değişirse (düzenleme) bayat thumbnail servis edilir; anahtara mtime+size eklenmeli.
- **`/api/export` GET ile yan etkili**: dosya sistemi değiştiren işlem GET olmamalı (EventSource kısıtı sebebiyle seçilmiş; fetch+ReadableStream ile POST'a çevrilebilir).
- **Export ilerlemesi atlanan dosyalarda yanlış**: `destinations.get(path) is None` durumunda `continue` ama yüzde `i` üzerinden — kozmetik.
- **Media type sabit `image/jpeg`**: format genişleyince yanlış olur.
- **`fyf-backend.spec` gitignore'da** (`.gitignore:15` `*.spec`): build tarifi versiyonlanmıyor; CI kendi komutunu kullanıyorsa spec ile drift oluşur. Spec izlenmeli.
