# 06 — İyi Niyetle Yapılmış Ama Yanlış Düşünülmüş Kararlar

> **Durum (2026-07-12):** ✅ 6.5 uçucu state → kalıcılık (F0.1) · ✅ 6.6 yarım-kalan port keşfi tamamlandı (F0.3) · 🟡 6.1 burst sessiz iyi-kare kaybı: gruplar UI'da görünür + undo (F1.1/F0.2) ama otomatik ön-seçim sürüyor · ✅ 6.7 duplicate/similar docstring-kod çelişkisi giderildi. **Açık:** 6.2 karanlık cezası sabitleri, 6.3 top-2 keskinlik, 6.4 kopya-vs-taşı export akışı, 6.8 EXIF skoru profil varsayımı, 6.9 `*.spec` versiyon dışı.

Bu bölüm, "kötü kod" değil, **doğru bir problemi çözmek isterken yanlış modele oturmuş** tasarım kararlarını toplar. Her biri için niyet, neden yanlış çıktığı ve doğrusu.

## 6.1 "Makine en iyi kareyi seçsin" → sessiz iyi-kare kaybı
**Niyet:** Kullanıcıyı burst yığınlarını tek tek gezmekten kurtarmak (`duplicates.py:122-123`).
**Neden yanlış:** Culling'de otomasyonun görevi *aday daraltmak*tır, *karar vermek* değil. `(quality_score, file_size)` kompozisyondan ve "an"dan habersizdir; robotun şut anını yumuşak diye eleyip boştaki keskin kareyi tutar. Elenen kareler `reject/similar`e düştüğü ve UI grupları göstermediği için kullanıcı kaybı fark edemez. Bir culling aracının kredibilitesini bitirecek tek hata türü budur: "iyi fotoğrafımı çöpe atmış."
**Doğrusu:** Burst grubu bir UI nesnesi olmalı; motorun seçimi yalnızca ön-işaretleme. Skor farkı küçükken otomatik eleme hiç yapılmamalı.

## 6.2 "Karanlık cezasını yarıya indirelim" → sabitlerle bağlam taklidi
**Niyet:** FRC salonları doğal olarak karanlık; karanlığı cezalandırma (`technical.py:60`, `compute_exposure`).
**Neden yanlış:** Doğru gözlem, yanlış mekanizma. 0.5 çarpanı ve 30/225 eşikleri *bir* salonun istatistiğine göre seçilmiş sabitler; farklı salonda (aydınlık fuaye, dış mekan off-season etkinliği) yanlış tarafa çeker. Bağlam duyarlılığı sabitle değil, oturumun kendi histogramından türetilen eşiklerle sağlanır. Yarım kalmışlığın kanıtı kodda: `DARK_RATIO_THRESHOLD` tanımlı ama kullanılmıyor, `reject/dark/` klasörü var ama hiçbir fotoğraf oraya düşmüyor.
**Doğrusu:** Oturum başında parlaklık dağılımını çıkar, eşikleri medyana göre kaydır; "bu etkinlik karanlık bir salonda" bilgisini otomatik öğren.

## 6.3 "En keskin 2 karo yeter" → kısmi keskinliği tam keskinlik sayma
**Niyet:** Üçler kuralıyla çerçevelenmiş konuları ve tek karoluk anomalileri (skorbord) doğru değerlendirmek (`technical.py:32-49`).
**Neden yanlış:** Top-2 ortalaması, karenin %78'i bulanık olsa bile iki dokulu bölge bulursa fotoğrafı "keskin" ilan eder. Hareket bulanıklığı tipik olarak yönlüdür ve konunun üzerindedir; arka plandaki keskin tribün yazısı iki karoyu kurtarır. Yani filtre tam da yakalaması gereken hatayı (konusu bulanık kare) kaçırmaya eğilimli.
**Doğrusu:** Karo skorlarını konum-ağırlıklı değerlendir (merkez + üçler kuralı kesişimleri) ya da en dokulu karoların *tutarlılığına* bak; uzun vadede konu tespiti ile konunun üzerinde ölç.

## 6.4 "Kopyalayalım, orijinale dokunmayalım" → yarım kalmış güvenlik
**Niyet:** Non-destructive işlem; kullanıcı dosyası asla riske girmesin (`utils.py:84`, export copy).
**Neden yanlış:** Tek başına kopya doğru bir başlangıç, ama iş akışı sonlandırılmamış: disk kullanımı ikiye katlanır (etkinlik başına 50-100 GB gerçekçi), kullanıcı "orijinalleri şimdi silebilir miyim?" sorusuyla baş başa bırakılır, ikinci export `_2` kopyalarıyla çıktıyı çoğaltır. Güvenlik hissi verirken dağınıklık üretir.
**Doğrusu:** Export sonunda doğrulama (kopya sayısı/boyut eşleşmesi) + "orijinalleri geri dönüşüm kutusuna taşı" opsiyonu; ikinci export öncesi çıktı klasörü dolu uyarısı.

## 6.5 "State'i RAM'de tutalım, basit olsun" → emeğin tek kopyası uçucu bellekte
**Niyet:** Veritabanı/dosya karmaşası olmadan basit oturum modeli (`backend/state.py`).
**Neden yanlış:** Basitlik doğru hedef, ama *neyin* basit tutulacağı yanlış seçilmiş. Analiz sonuçları yeniden üretilebilir (pahalı ama mümkün); kullanıcı override'ları ise **yeniden üretilemez insan emeği**. En değerli veri en uçucu yerde duruyor. "Sidecar zaten uygulamayla yaşıyor" varsayımı da yanlış: pencere kapatma, güncelleme (relaunch!), çökme — hepsi olağan yaşam döngüsü olayları.
**Doğrusu:** Override'lar her değişiklikte diske; analizler mtime+size anahtarlı cache'e. In-app güncelleme akışı `relaunch()` çağırdığı için bu eksik, güncelleme özelliğiyle de çelişiyor.

## 6.6 "Port'u stdout'tan bildirelim" → mekanizma kuruldu, tüketilmedi
**Niyet:** Sabit port çakışmalarına karşı dinamik port + keşif (`server.py:find_free_port`, `lib.rs:get_backend_port`).
**Neden yanlış:** Zincirin üç halkası (backend basar → Rust yakalar → frontend sorar) kurulmuş ama son halka hiç bağlanmamış; frontend 9470'i hardcode ediyor (`App.tsx:102`). Dinamik port altyapısının tüm karmaşıklığı ödenmiş, faydası alınmamış — 9470 doluysa sistem yine de bozuluyor, üstelik "neden çalışmıyor" izi bırakmadan.
**Doğrusu:** Ya zinciri tamamla (frontend `invoke` etsin) ya da dürüstçe sabit porta dön ve çakışmada anlaşılır hata ver. Yarısı-dinamik en kötü ikisi.

## 6.7 "Duplicate'ler zaten elendi, benzerlere geçelim" → kategoriler tespit sırasının yan ürünü
**Niyet:** Önce kesin kopyaları, sonra burst'leri ayıklayan iki geçişli sistem (`duplicates.py:147-180`).
**Neden yanlış:** "Duplicate" ve "similar" kullanıcıya sunulan *anlamsal* kategoriler, ama gerçekte hangi etiketi alacağın SSIM eşiğinin hangi tarafına düştüğüne (0.95 kıyısı) ve Pass 1'in seni görüp görmediğine bağlı. Aynı gerçek kopya çifti, JPEG sıkıştırma farkıyla "similar" etiketi alabilir. Kullanıcı etikete güvenerek `reject/duplicate`i bakmadan silerse yanlış bilgiyle risk almış olur. Docstring'in koddan kopmuş olması (doc: pHash≤15/SSIM>0.75, kod: 20/ORB 0.25) bu bölgenin el yordamıyla ayarlandığını gösteriyor.
**Doğrusu:** Tespiti tek havuzda yap, etiketi kanıta göre ver (SSIM ve eşleşme skorlarını raporla); eşikleri fixture setiyle regresyon testine bağla.

## 6.8 "FRC'ye özel ayar" → tek fotoğrafçı profili varsayımı
**Niyet:** Spor fotoğrafçılığına göre EXIF skorlaması: hızlı enstantane iyi, yüksek ISO kötü (`technical.py:72-93`).
**Neden yanlış:** FRC medya ekibi yalnızca aksiyon çekmez: pit röportajları, takım pozları, tribün, ödül töreni, panning denemeleri. Hepsine "1/1000 iyidir" cetveli uygulanıyor; tripodlu takım fotoğrafı ve sanatsal panning sistematik olarak cezalandırılır. Ayrıca ISO ve enstantane bağımsız puanlanıyor; oysa aralarındaki takas (ISO'yu yükseltip donduran fotoğrafçı doğru yapıyor) skorun tam tersine çevirdiği şey.
**Doğrusu:** EXIF'i skor bileşeni yapmak yerine *açıklayıcı sinyal* olarak kullan (UI'da göster, filtrele); skora katılacaksa enstantane yalnızca "bulanıklık şüphesini" desteklesin (keskinlik zaten düşükse).

## 6.9 "`.gitignore`'a `*.spec` koyalım" → build tarifinin kendisi versiyon dışı
**Niyet:** PyInstaller'ın ürettiği geçici spec dosyalarını repoya sokmamak.
**Neden yanlış:** `fyf-backend.spec` üretilen değil, elle bakımı yapılan build tanımı — ve şu an git'te yok. Yeni katkıcı repo'yu klonlayınca sidecar'ı README'deki (spec'ten farklılaşabilen) komutla üretmek zorunda; CI ile yerel build sessizce ayrışır.
**Doğrusu:** `!fyf-backend.spec` istisnası; sürüm tekilleştirmesiyle birlikte ([05](05-build-release.md) 5.2).
