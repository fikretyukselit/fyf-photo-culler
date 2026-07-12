# 02 — Analiz Motoru (`culling/`)

## Nasıl Çalışıyor (özet)

1. **Skorlama** (`technical.py:analyze_photo`): görüntü 1024px'e küçültülür → 3×3 grid Laplacian varyansının en iyi 2 karosunun ortalaması (keskinlik), koyu/parlak piksel oranı (pozlama), RMS std (kontrast), ISO + enstantane (EXIF skoru) → ağırlıklı toplam (%40 keskinlik, %25 pozlama, %15 kontrast, %20 EXIF).
2. **Otomatik red**: keskinlik < 85 (f/4.0 ve altı için 50) → `blurry`; parlak piksel oranı > %80 → `overexposed`. Karanlık bilinçli olarak auto-reject değil (arena farkındalığı — doğru karar).
3. **Duplicate/burst** (`duplicates.py:detect_duplicates_and_similar`): Pass 1 pHash ≤ 5 + SSIM > 0.95 → `duplicate`; Pass 2 (kalanlarda) pHash ≤ 20 + ORB eşleşme oranı > 0.25 → `similar`. Union-find ile gruplama, gruptan `(quality_score, file_size)` maksimumu tutulur.
4. **Organizasyon** (`organizer.py`): keep/ maybe/ reject/<sebep>/ klasörlerine kopyalama + JSON rapor.

Alan bilgisi takdire değer: karanlık arena toleransı (koyu piksel cezasının yarıya indirilmesi, `technical.py:52-62`), sığ DOF için düşük blur eşiği (`technical.py:149-154`), grid tabanlı keskinlik (üçler kuralı farkındalığı). Ancak uygulamada ciddi hatalar var.

## Kritik Hatalar

### 2.1 EXIF rotasyonu yok sayılıyor — `utils.py:18` ✅ doğrulandı
Tüm yükleme `cv2.imread` ile; OpenCV orientation tag'ini uygulamaz. Sonuçlar:
- Dikey çekilmiş (tag=6/8) fotoğrafla döndürülmüş kopyası SSIM/ORB'de eşleşmez → duplicate kaçar.
- pHash için `PIL.Image.open` kullanılıyor (`duplicates.py:17`) — PIL de `exif_transpose` çağrılmadan rotasyon uygulamaz, ama iki kütüphanenin davranış farkı ileride tutarsızlık üretebilir.

**Çözüm:** Tek yükleme yolu: PIL ile aç → `ImageOps.exif_transpose` → numpy'a çevir. Hem analiz hem thumbnail hem duplicate aynı yolu kullansın.

### 2.2 Keskinlik ölçümü kalibre edilemez — `technical.py:99,139` ✅ doğrulandı
Laplacian varyansı çözünürlüğe ve içerik dokusuna bağlıdır; 1024px'e küçültülmüş görüntüde ölçülüp `raw/500*100` ile normalize ediliyor ve `85`/`50` eşikleriyle karşılaştırılıyor. `500`, `85`, `50` sabitlerinin hiçbirinin türetimi belgelenmemiş. Küçültme boyutu, interpolasyon (INTER_AREA yumuşatır!) veya kamera değişince tüm eşikler kayar.

**Çözüm (kademeli):** (a) sabitlerin türetimini belgele + `scripts/compare_scoring.py`'ı kalibrasyon aracına dönüştür; (b) mutlak eşik yerine **oturum-içi göreli eşik** kullan (örn. medyanın %X altı = bulanık) — aynı salon/aynı kamera içinde çok daha sağlam; (c) uzun vadede frekans-alanı ölçüm ekle.

### 2.3 Docstring ile kod çelişiyor — `duplicates.py:130-132` vs `168,171` ✅ doğrulandı
Docstring "pHash ≤ 15, SSIM > 0.75" diyor; kod `threshold=20` + ORB `min_match_ratio=0.25` kullanıyor. Eşikler bir noktada değiştirilmiş, dokümantasyon güncellenmemiş. Kalibrasyon geçmişinin izlenemediğinin işareti.

### 2.4 İki geçişli tespit sıralı filtre gibi çalışıyor — `duplicates.py:164`
Pass 1'de reject edilenler Pass 2'ye girmiyor. SSIM eşiğinin hemen altında kalan gerçek bir duplicate (örn. 0.94), Pass 2'de "similar" etiketi alıyor — kullanıcıya yanlış sebep gösteriliyor. Ayrıca Pass 1 grubundan tutulan "en iyi" kare Pass 2'de başka bir grupla birleşip orada da elenebilir; zincirleme kayıp senaryosu test edilmemiş.

### 2.5 Ölü sabit — `technical.py:28` ✅ doğrulandı
`DARK_RATIO_THRESHOLD = 0.85` tanımlı ama hiçbir yerde kullanılmıyor. Muhtemelen "çok karanlıksa reddet" niyetiyle eklendi, sonra karanlık auto-reject kaldırıldı; sabit kaldı. `reject/dark/` klasörü `organizer.py`'da hâlâ var ama bu sebeple reddedilen fotoğraf üretilmiyor — UI'da boş kategori olarak yaşıyor.

### 2.6 EXIF üç kez ayrı ayrı okunuyor — `technical.py:146,150` + `utils.py:39`
`extract_exif` (PIL open #1) ve `_get_aperture` (PIL open #2) + `cv2.imread` = fotoğraf başına 3 dosya açılışı. Ayrıca ikisi de deprecated `_getexif()` özel API'sini kullanıyor (`utils.py:40`, `technical.py:124`) — Pillow'un gelecek sürümlerinde kırılır. `ISOSpeedRatings` tag'i de eski; yeni kameralar `PhotographicSensitivity` yazar → ISO okunamaz, EXIF skoru sessizce devre dışı kalır.

**Çözüm:** Tek `extract_exif` çağrısı; `img.getexif()` modern API; ISO için her iki tag'i dene; aperture'ı da aynı fonksiyondan döndür.

### 2.7 O(n²) çift karşılaştırma — `duplicates.py:26-30`
1.000 fotoğraf = ~500K hash karşılaştırması (tolere edilir) ama pHash ≤ 20 gibi gevşek eşikte aday çifti sayısı patlar ve her aday için görüntü diskten yeniden yüklenip ORB koşuyor (`duplicates.py:69-77`) — önbellek yok, paralellik yok. 5.000+ fotoğraflık bölge yarışmasında saatler sürebilir.

**Çözüm:** (a) BK-tree / LSH ile aday bulma; (b) **EXIF zaman damgasıyla ön gruplama** — burst'ler zaten ±1-2 sn içindedir, karşılaştırma uzayını %95+ küçültür; (c) `multiprocessing` ile doğrulama paralelleştirme; (d) yüklenen 512px görüntüleri LRU cache'te tut.

## Tasarım Eleştirileri (FRC senaryosuna göre)

### 2.8 Burst'ten tek kare tutma — sessiz iyi-kare kaybı (`duplicates.py:122-123`)
`(quality_score, file_size)` maksimumu: (a) dosya boyutu kalite göstergesi değildir; (b) skor kompozisyondan, robotun havadaki anından, ifadeden habersizdir. Robotun şut anı hafif yumuşak, boşta durduğu kare jilet gibiyse motor yanlış kareyi tutar ve doğrusunu `reject/similar/`e atar. Kullanıcı reject klasörünü tek tek taramadıkça fark etmez.

**Doğru tasarım:** Burst grupları **korunmalı ve UI'a taşınmalı** — otomatik seçim yalnızca "öneri" olmalı (bkz. [07](07-ozellik-yol-haritasi.md) F2). Skor farkı küçükse (örn. <10 puan) hiç otomatik eleme yapılmamalı.

### 2.9 EXIF skoru pan/sanatsal çekimi cezalandırıyor — `technical.py:84-91`
Enstantane skoru "ne kadar hızlı o kadar iyi" varsayar (1/30 → 0, 1/1000 → 100). Kasıtlı panning (1/60'ta akan arka plan) veya tripodlu geniş açı hem enstantane hem muhtemelen keskinlik cezası yer. Ayrıca ISO ve enstantane bağımsız skorlanıyor; oysa ikisi pozlama üçgeninin parçası — ISO 6400 + 1/2000 (doğru spor tercihi) cezalandırılırken ISO 100 + 1/40 ödüllendirilebiliyor.

### 2.10 Sabit ışık eşikleri — `technical.py:26-29`
`DARK=30`, `BRIGHT=225` her salona aynı uygulanıyor. Karanlık salonda doğru pozlanmış bir fotoğrafla aydınlık fuayede çekilmiş fotoğraf aynı cetvelle ölçülüyor. Oturum başında tüm fotoğrafların medyan parlaklığı çıkarılıp eşikler ona göre kaydırılmalı (venue-adaptive).

### 2.11 Yalnızca .jpg/.jpeg ve non-recursive tarama — `utils.py:59-70` ✅ doğrulandı
- Alt klasörler taranmıyor: SD kartın `DCIM/100CANON/`, `101CANON/` yapısını seçen kullanıcı 0 fotoğraf görür, nedenini anlamaz.
- `.JPG` uzantısı çalışır (lower var) ama PNG/HEIC/WebP/RAW (CR2/CR3/NEF/ARW) sessizce atlanır. FRC ekiplerinde RAW+JPEG çekim yaygın — RAW'ları es geçmek kabul edilebilir bir v1 kararı, ama **sessiz olması** değil: "N dosya atlandı (desteklenmeyen format)" raporlanmalı.

## Performans Özeti

| Sorun | Yer | Etki (1000 foto) |
|---|---|---|
| 3× dosya açma (cv2 + PIL×2) | `technical.py`, `utils.py` | ~2000 gereksiz I/O |
| Seri analiz, tek çekirdek | `analysis.py:_run_pipeline` | 8 çekirdekli makinede ~8× yavaş |
| O(n²) + diskten tekrar yükleme | `duplicates.py` | Aday sayısına göre dakikalar→saatler |
| pHash için tam boyut decode | `duplicates.py:17` | Thumbnail cache'i varken israf |

## Test Durumu

`tests/test_technical.py` yalnızca skorlama fonksiyonlarını sentetik görüntülerle test ediyor (~%50 `technical.py` kapsamı). **Hiç test yok:** `duplicates.py`, `organizer.py`, `utils.py`, EXIF ayrıştırma, `analyze_photo` uçtan uca, bozuk dosya/kenar durumları. En riskli modül (duplicates — veri kaybı potansiyeli) tamamen test dışı. Ayrıca bilinen duplicate/burst içeren küçük bir **gerçek fotoğraf fixture seti** olmadan eşik değişikliklerinin regresyonu ölçülemez.
