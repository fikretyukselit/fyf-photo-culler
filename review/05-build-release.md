# 05 — Build, Release ve Repo Hijyeni

## Mevcut Pipeline

`v*` tag push → 4 hedefli matris (macOS arm64/x64, Windows x64, Linux x64) → PyInstaller sidecar → Tauri build → artefaktlar + `latest.json` üretimi → GitHub Release. Tauri updater minisign public key ile imza doğruluyor; in-app güncelleme popup'ı çalışıyor. Bir gönüllü projesi için ciddi ve büyük ölçüde doğru kurulmuş bir altyapı.

## Sorunlar

### 5.1 CI'da hiçbir kalite kapısı yok
Release workflow test, lint, type-check koşmuyor. `tests/test_technical.py` var ama hiçbir yerde çalışmıyor; `tsc --noEmit` yok; PR/push tetikli ayrı bir CI workflow'u da yok. Python'da sözdizimi hatası bile ancak build sonrası elle fark edilir. **En ucuz kazanım:** her PR'da pytest + tsc + (ruff/mypy) koşan bir `ci.yml`.

### 5.2 Sürüm 4 yerde, biri yanlış
`tauri.conf.json` = `package.json` = `Cargo.toml` = 0.1.3, ama `pyproject.toml` = **1.0.0**. Makefile'daki `bump-version` hedefi pyproject'i güncellemiyor. Tek kaynak (VERSION dosyası veya bump script'ine pyproject eklenmesi) şart.

### 5.3 `latest.json` üretimi sessizce bozulabilir — `release.yml`
`find_asset()`/`read_sig()` yardımcıları artefakt bulunamazsa boş string basıyor; updater manifest'i boş URL'lerle yayınlanır ve otomatik güncelleme tüm kullanıcılarda kriptik biçimde bozulur. Boş değerde `exit 1` eklenmeli. Artefakt adındaki "FYF Photo Culler" sabiti de `tauri.conf.json`'daki `productName` ile elle senkron — `jq` ile config'den okunmalı.

### 5.4 İmzalama / notarizasyon yok
macOS bundle imzasız → Gatekeeper "doğrulanamayan geliştirici" uyarısı; Windows'ta imzasız PyInstaller onefile + **UPX** (`fyf-backend.spec`) antivirüs false-positive'lerinin klasik reçetesi. Teknik olmayan hedef kitle (öğrenci medya ekipleri) için bu, kurulumda vazgeçirici. Asgari: UPX'i kapat; ideali: Apple Developer ID + notarize adımı, Windows için imza sertifikası.

### 5.5 Sidecar yaşam döngüsü pürüzleri (`ui/src-tauri/src/lib.rs`)
[01-mimari.md](01-mimari.md) §2'de detaylı: port bekleme timeout'u yok, stderr okunmuyor, child port satırından önce ölürse takip edilmiyor, dev fallback `mem::forget` ile yetim süreç bırakıyor. Ayrıca `on_window_event(Destroyed)` anında `kill()` — süren bir export'un ortasında süreç kesilir; önce graceful shutdown (SIGTERM/endpoint) denenmeli.

### 5.6 Repo hijyeni
Büyük ölçüde temiz: 76 izlenen dosya, `.git` 2.8 MB, artefaktlar/venv/PDF ignore'da. İki pürüz:
- **`.gitignore:15`'teki `*.spec`** yüzünden `fyf-backend.spec` versiyonlanmıyor — build tarifi kaybolmaya açık. Kural `fyf-backend.spec`'i hariç tutacak şekilde daraltılmalı (`!fyf-backend.spec`).
- Kök dizindeki `.thumbnails/` (370+ jpg) backend'in CWD'ye yazmasının belirtisi; ignore etmek semptomu gizliyor, asıl düzeltme cache'in platform dizinine taşınması ([03](03-backend.md)).

### 5.7 Eksik güvenlik/kalite otomasyonu
`pip-audit` / `cargo audit` / `bun audit` yok; updater private key rotasyon prosedürü belgelenmemiş (SECURITY.md yok); crash reporting yok (kullanıcı çökmesi görünmez kalıyor).

## Önerilen Sıra

1. `ci.yml`: pytest + tsc + ruff her PR'da (yarım gün)
2. `latest.json` boş-artefakt kontrolü + productName'i config'den okuma (1 saat)
3. Sürüm tekilleştirme, `fyf-backend.spec`'i versiyona alma (1 saat)
4. UPX kapatma + `--onedir` denemesi (açılış süresi ölçümüyle)
5. macOS signing/notarization (Apple Developer hesabı gerektirir — vakıf üzerinden)
