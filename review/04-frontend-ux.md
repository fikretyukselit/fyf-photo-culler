# 04 — Frontend / UX (`ui/src`)

## Akış

Landing (klasör seçimi, merge toggle, çıktı klasörü) → Processing (SSE ilerleme, 3 aşama) → Review (kategori sekmeleri, sanal grid, sağda detay paneli, K/M/R kısayolları, çoklu seçim) → Export (özet + SSE ilerleme).

Güçlü yanlar: sanal grid (1000+ fotoğrafta akıcı), klavye ile hızlı kategorizasyon, skor rozetleri, tam ekran önizleme, TR/EN i18n, OkLCH tabanlı tutarlı tema.

## Buglar / Teknik Sorunlar

### 4.1 Port hiç alınmıyor — `App.tsx:101-104` ✅ doğrulandı (kritik)
`useSessionStore`'daki `backendPort` hiçbir yerde set edilmiyor (`stores.ts:67`'deki `setBackendPort` ölü kod); `api.setPort(backendPort ?? 9470)` her zaman 9470'e düşüyor. Rust'taki `get_backend_port` komutu frontend'den hiç `invoke` edilmiyor. 9470 dolu olduğunda (ikinci uygulama kopyası, port çakışması) uygulama hiçbir hata göstermeden çalışmaz. **Düzeltme:** açılışta retry'lı `invoke("get_backend_port")`, başarısızsa kullanıcıya anlaşılır hata ekranı.

### 4.2 SSE dayanıklılığı yok — `Processing.tsx:46-88`, `Export.tsx:41-72`
- `onerror`'da yeniden bağlanma yok; analiz sürerken anlık bir kopma tüm süreci "hata"ya çevirir (oysa backend'de analiz devam ediyor — yeniden bağlanınca kaldığı yerden gösterilebilirdi).
- Heartbeat/timeout yok: backend sessizce ölürse UI sonsuza dek bekler.
- Normal tamamlanmada da EventSource kapanışı `onerror` tetikler; "bitti" ile "koptu" ayrımı `stage`'e bakılarak yapılıyor, kırılgan ([03](03-backend.md) 3.5 ile birlikte düzeltilmeli).

### 4.3 i18n kaçakları
`Processing.tsx:70,81` ("Analysis was cancelled.", "Lost connection..."), `Export.tsx:70`, `Review.tsx:771` ("Loading...") hardcoded İngilizce — tam da Türkçe kullanıcıların göreceği hata mesajları çeviri dışı.

### 4.4 Sessiz hata durumları
- `Review.tsx:587-606`: fotoğraf listesi isteği başarısız olursa boş grid + "bu kategoride fotoğraf yok" — hata ile boşluk ayırt edilemiyor.
- `Export.tsx:37-39`: preview hatası yutuluyor.

### 4.5 Klavye kısayolu kenar durumları
K/M/R kontrolü yalnızca `HTMLInputElement` hedefini dışlıyor (`Review.tsx:622-630`); select/contenteditable durumlarında ve odak bir butondayken ok tuşları grid'i de oynatıyor. Ayrıca kategori değişince detay paneli bayat fotoğrafı göstermeye devam ediyor (`Review.tsx:609-614`).

## Culling Ergonomisi — Asıl Mesele

Uygulamanın hedef işi "yüzlerce fotoğrafı hızla ayıklamak", ama bu işin endüstri standardı üç temel taşı eksik:

| İhtiyaç | Durum | Neden kritik |
|---|---|---|
| **Undo** | ❌ | Yanlış toplu işlem (50 fotoyu R'lemek) geri alınamıyor. Tek başına en ucuz/en değerli eksik. |
| **Yan yana karşılaştırma** | ❌ | Burst içinden seçim tam ekranı aç-kapa döngüsüyle yapılıyor. Photo Mechanic/Lightroom'un varlık sebebi bu görünüm. |
| **Duplicate/burst gruplarının görünürlüğü** | ❌ | Backend grupları biliyor ama UI'a taşımıyor; kullanıcı `reject/similar`e düşen karelerin *neyin benzeri* olduğunu göremiyor. Motorun yanlış seçtiği kareyi kurtarmanın pratik yolu yok. |

Diğer eksikler: 100% zoom (odak kontrolü için tam ekran yetmez, 1:1 gerekir), EXIF/skor bazlı filtre ("ISO > 3200'leri göster"), skor uyuşmazlığına atlama ("yüksek skorlu ama reject'te olanlar"), grid'de bir sonraki fotoğrafa otomatik ilerleme (detay panelinde var, grid'de yok).

"Maybe" kategorisi düşük maliyetli iyi bir fikir; ama duplicate/similar rejectleri ile kalite rejectlerinin aynı "Reject" sekmesinde toplanması, motorun en riskli kararlarının (benzer eleme) gözden geçirilmesini zorlaştırıyor — ayrı sekme/rozet hak ediyor.

## Performans / Erişilebilirlik (kısa)

- Satır yüksekliği tahmini sabit; farklı en-boy oranlarında scroll zıplaması olabilir.
- Tam boyut görüntü her açılışta yeniden indiriliyor; basit bir in-memory cache yeterli.
- Kategori sekmeleri renk-köru kullanıcı için yalnızca renkle ayrışıyor; ikon/etiket eklenmeli. Tam ekran modal `role="dialog"` değil; ilerleme yüzdesi `aria-live` değil.

## Öncelik Sırası (frontend)

1. Port keşfini gerçekten kullan (4.1) — güvenilirlik
2. Undo + override geçmişi — veri güvenliği hissi
3. Burst/duplicate gruplarını UI'a taşı + karşılaştırma görünümü — ürünün ana vaadi
4. SSE reconnect/timeout (4.2)
5. i18n kaçakları + hata durumları (4.3, 4.4)
