# 07 — Özellik Yol Haritası Önerisi

> **Güncelleme (2026-07-12):**
> - **Faz 1** uygulandı: F1.1 (grup yığını UI + GroupPanel), F1.2 (Compare — senkron zoom/pan), F1.4 (skor/ISO/sebep filtreleri + "motorla çelişenler"), F1.5 (EXIF zaman penceresi + grupların API'a taşınması). İnceleme sırasında bulunan kritik bug düzeltildi: manuel reject override'ı backend'de geçersiz sayılıyordu (sessiz 400).
> - **Faz 0 tamamlandı:** F0.1 (oturum kalıcılığı + devam et), F0.2 (undo/redo), F0.3 (port keşfi + bağlanıyor/hata ekranları), F0.4 (recursive tarama + atlanan dosya raporu), F0.5 (CI kalite kapısı — ruff+pytest+tsc+build her PR/push'ta).
> - Test suite 15 → 50'ye çıktı. Tüm değişiklikler `feature/faz1-culling-workflow` branch'inde.

İlke: Önce **güven** (veri kaybetme), sonra **iş akışı** (hızlı culling), sonra **zekâ** (daha iyi otomatik karar). Kullanıcı motora güvenmezse hiçbir akıllı özellik anlam taşımaz.

## Faz 0 — Güven ve Stabilite (0.2.x, ~1-2 hafta)

| # | Özellik | Gerekçe | Efor |
|---|---|---|---|
| F0.1 | **Oturum kalıcılığı + devam et** — override'lar her değişiklikte diske, analiz cache'i mtime+size anahtarlı, açılışta "önceki oturuma devam" | En pahalı eksik; update `relaunch()`'ı bile mevcut emeği siliyor | Orta |
| F0.2 | **Undo/redo** — override geçmişi yığını, `Cmd/Ctrl+Z`, toplu işlemler tek adım olarak | Toplu R tuşunun panzehiri; F0.1'in üstüne ucuz | Düşük |
| F0.3 | **Port keşfini tamamla** — `invoke("get_backend_port")` + retry + anlaşılır hata ekranı; Rust'ta timeout + stderr log | Bugünkü en olası "uygulama açılmıyor" sebebi | Düşük |
| F0.4 | **Recursive tarama + atlanan dosya raporu** — alt klasörler taransın; "37 dosya atlandı (RAW/PNG)" bildirimi | Sessiz veri kaybı algısını bitirir | Düşük |
| F0.5 | **CI kalite kapısı** — pytest + tsc + ruff her PR'da; `latest.json` boş-artefakt kontrolü | Regresyon sigortası; sonraki fazların önkoşulu | Düşük |

## Faz 1 — Culling İş Akışı (0.3.x, ~1 ay)

| # | Özellik | Gerekçe | Efor |
|---|---|---|---|
| F1.1 | **Burst/duplicate gruplarını UI'da göster** — grid'de yığın (stack) görünümü, grup rozetleri, "motorun seçimi" işareti; reject'e düşenler grubuyla birlikte görünür | 6.1'deki sessiz kayıp probleminin çözümü; ürünün ana vaadinin görünür hâli | Orta |
| F1.2 | **Karşılaştırma görünümü** — `C` ile 2-4 kareyi yan yana, senkron zoom/pan, kazananı seç-gerisini reddet | Burst seçiminin endüstri standardı ergonomisi | Orta |
| F1.3 | **1:1 zoom** — detay panelinde tıkla-büyüt (odak kontrolü), keskinlik haritası overlay'i (grid karo skorları ısı haritası olarak) | Motorun kararını kullanıcıya *açıklar*; güven inşa eder | Orta |
| F1.4 | **Filtre/sıralama** — skor aralığı, ISO/enstantane/diyafram, reject sebebi, "skorla kararım çelişenler" hızlı filtresi | 2000 fotoğrafta gezinmeyi hedefli taramaya çevirir | Düşük-Orta |
| F1.5 | **EXIF zaman damgasıyla burst ön-gruplama** — ±1-2 sn penceresi; O(n²) karşılaştırma uzayını daraltır, grupları anlamlandırır | Hem performans hem doğruluk; F1.1'in altyapısı | Düşük |

## Faz 2 — Motor Olgunlaşması (0.4.x)

| # | Özellik | Gerekçe |
|---|---|---|
| F2.1 | **Venue-adaptive eşikler** — oturum histogramından karanlık/parlak/keskinlik eşiklerini türet; "kalibrasyon" adımı Processing'e eklenir | Sabit eşik sorunlarının (6.2) kalıcı çözümü |
| F2.2 | **Fixture tabanlı kalibrasyon seti** — bilinen duplicate/burst/bulanık örneklerle regresyon testi; eşik değişimi PR'da ölçülür | Docstring-kod kopmasının (6.7) tekrarını önler |
| F2.3 | **Paralel analiz** — `ProcessPoolExecutor` ile çekirdek sayısı kadar worker; tek görüntü yükleme yolu (PIL + exif_transpose) | 8× hız + EXIF rotasyon düzeltmesi tek pakette |
| F2.4 | **RAW desteği (aşama 1: eşleştirme)** — RAW+JPEG çiftlerini tanı, JPEG üzerinden analiz et, kararı RAW'a da uygula | FRC'de yaygın çekim modu; tam RAW decode gerektirmeden değer üretir |
| F2.5 | **XMP sidecar / IPTC yazımı** — keep/maybe/reject kararını ve skoru XMP'ye yaz | Lightroom'a geçen kullanıcı emeğini taşır; kilitlenme hissini kaldırır |

## Faz 3 — Zekâ ve Ekip Özellikleri (1.0+)

| # | Özellik | Gerekçe |
|---|---|---|
| F3.1 | **Konu tespiti** — hafif bir detektörle (YOLO-nano sınıfı) robot/insan kutusu; keskinlik konu üzerinde ölçülür | 6.3'ün nihai çözümü; bokeh'li portreleri kurtarır |
| F3.2 | **Takım numarası OCR** — bumper numarasından otomatik etiketleme; takıma göre klasörleme/filtreleme | FRC'ye özgü katil özellik: "5655'in tüm fotoğrafları" |
| F3.3 | **Öğrenen skorlayıcı** — kullanıcı override'ları etiketli veri; oturumlar arası basit bir model motoru fotoğrafçının zevkine yaklaştırır | Override verisi zaten toplanıyor; bedava eğitim seti |
| F3.4 | **Rust'a taşınmış motor / sidecar'sız dağıtım** — [01-mimari.md](01-mimari.md) B seçeneği | Açılış süresi, boyut, antivirüs sorunlarının kökten çözümü |

## Bilinçli Olarak Önerilmeyenler

- **Bulut senkronizasyonu / hesap sistemi** — yerel-öncelikli araç olması değer önerisinin parçası; sunucu maliyeti gönüllü projeyi yorar.
- **Fotoğraf düzenleme (crop/renk)** — kapsam kayması; culling aracı düzenleyiciye evrilmemeli, XMP ile (F2.5) düzenleyicilere köprü kurmalı.
- **5 yıldızlı derecelendirme** — Keep/Maybe/Reject üçlüsü hedef kitleye (öğrenci gönüllüler) uygun; yıldız sistemi karar yorgunluğu ekler. Bunun yerine F1.1'in "hero" işareti yeterli.
