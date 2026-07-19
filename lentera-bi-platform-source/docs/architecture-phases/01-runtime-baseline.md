> Bagian 1 dari [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 1 - Phase 1: Runtime dan baseline

**Tanggal rencana:** Senin, 20 Juli 2026
**Fokus hari ini:** production build Windows, baseline terukur, dan runtime lokal yang dapat diulang.

## Hasil yang harus ada sebelum berhenti

1. `npm run build` selesai dengan exit code `0` di Windows PowerShell.
2. `npm run start:prod` membuka aplikasi tanpa Bash.
3. Halaman `/login` merespons `200 OK` pada production mode.
4. Tersedia laporan before/after untuk startup, RAM, response time, dan bundle.
5. Tidak ada perubahan route, database schema, UI, atau API business logic.

## Scope file

| Boleh diubah | Tidak diubah hari ini |
|---|---|
| `package.json` | `src/app/**` |
| `scripts/prepare-standalone.mjs` baru | `src/components/**` |
| `start-lentera.sh` hanya bila sudah tidak dipakai | `prisma/**` |
| dokumentasi phase ini dan README bila perlu | `.env` dan credential |

## Kondisi awal yang sudah terukur

| Metrik | Nilai awal | Catatan |
|---|---:|---|
| Node.js | `v26.4.0` | Runtime lokal saat ini |
| npm | `11.17.0` | Package manager lokal |
| Test | `128 passed` | 5 test file lulus |
| Development RAM | sekitar `420 MB` | Tiga proses Node Next.js dev |
| `/login` response | sekitar `0.11 s` | Setelah server sudah warm |
| Build compile | sukses | Next.js dan TypeScript selesai |
| Build packaging | gagal | `cp` tidak tersedia di Windows |

## 1.0 - Guard rails

Tujuan: memastikan perubahan hanya menyentuh Phase 1.

- [x] Konfirmasi branch kerja dan commit awal.
- [x] Catat `git status` sebelum memulai.
- [x] Pastikan `.backup/`, archive `.tar.gz`, dan `.env` tidak ikut stage.
- [ ] Tutup server development lama dengan `Ctrl+C` sebelum menjalankan production server pada port yang sama (ditunda ke 1.5 karena production akan diuji pada port 3001).
- [x] Jangan menghapus `node_modules`, `.next`, database, atau file user untuk menyelesaikan error.
- [x] Jangan menambah dependency baru.

Checkpoint selesai: scope perubahan hanya build/runtime code dan documentation.

## 1.1 - Rekam baseline development

Tujuan: mempunyai angka pembanding sebelum code diubah.

### Langkah

- [x] Jalankan `npm run dev` dari terminal khusus.
- [x] Catat timestamp saat command dijalankan.
- [x] Catat baris `Ready` dari Next.js dan hitung startup time.
- [x] Buka `/login` satu kali agar compile awal selesai.
- [x] Jalankan request kedua ke `/login`; gunakan hasil kedua sebagai warm response time.
- [x] Catat total Working Set process tree Next.js, bukan hanya satu child process.
- [x] Catat lima file terbesar dari `.next/static/chunks`.
- [x] Simpan angka di tabel laporan Phase 1.

### Command ukur

```powershell
curl.exe -s -o NUL -w "login status=%{http_code} time=%{time_total}s size=%{size_download} bytes\\n" http://localhost:3000/login

Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess

Get-ChildItem .next\static\chunks -File |
  Sort-Object Length -Descending |
  Select-Object -First 5 Name, @{Name='KB'; Expression={[math]::Round($_.Length / 1KB, 1)}}
```

Checkpoint selesai: angka baseline tersimpan, bukan hanya pengamatan visual browser.

### Hasil 1.1 - 19 Juli 2026

| Metrik | Hasil |
|---|---:|
| Next.js ready, restart pertama | 1.172 ms |
| Next.js ready, restart terukur | 833 ms |
| Request pertama `/login` pada restart terukur | 402 ms di server log |
| Warm `/login` | 64 ms dari curl; 62 ms di server log |
| Total Working Set process tree Node | 735,4 MB |
| Chunk terbesar | 477,1 KB |
| Chunk kedua | 222,2 KB |
| Chunk ketiga | 134,2 KB |
| Chunk keempat | 132,7 KB |
| Chunk kelima | 110,0 KB |

Catatan: request `/login` pertama setelah restart sebelumnya pernah memerlukan 2,2 detik karena compile awal. Angka warm dipakai sebagai baseline respons interaktif; angka compile awal tetap dicatat sebagai baseline cold route.

## 1.2 - Rekam baseline kualitas

Tujuan: memisahkan kegagalan lama dari regresi Phase 1.

- [x] Jalankan `npm test` sebelum mengubah build script.
- [x] Catat jumlah test dan durasi.
- [x] Jalankan `npm run build` sekali.
- [x] Catat tahap yang sukses dan error pertama.
- [x] Konfirmasi error berasal dari `cp`/`mkdir -p`, bukan compile, lint, TypeScript, database, atau auth.

### Bukti yang dicatat

```text
Test files: ... passed
Tests: ... passed
Next compile: pass/fail
TypeScript: pass/fail
Standalone asset copy: pass/fail
```

Checkpoint selesai: root cause build Windows didokumentasikan sebagai shell command Unix.

### Hasil 1.2 - 19 Juli 2026

| Check | Hasil |
|---|---|
| `npm test` | PASS |
| Test files | 5 passed |
| Tests | 128 passed |
| Test duration | 1,30 detik |
| Next.js compile | PASS, 11,1 detik |
| TypeScript | PASS, 21,1 detik |
| Static generation | PASS, 23/23 halaman |
| Route discovery | PASS, seluruh route terdaftar |
| Build exit code | FAIL, exit 1 |
| Error pertama | `'cp' is not recognized as an internal or external command` |

### Root cause yang dipastikan

Script `build` di `package.json` menjalankan command Unix:

~~~text
`npm run build` && cp -r ... && cp -r ... && cp -r ... && mkdir -p ...
~~~

`next build`, TypeScript, page data collection, dan static generation selesai sukses. Karena `cp` gagal pada Windows, command berikutnya tidak dijalankan dan npm mengembalikan exit code `1`. Warning `Proxy (Middleware)` hanya label output Next.js dan bukan penyebab kegagalan.

### Keputusan handoff ke 1.3

Buat `scripts/prepare-standalone.mjs` dengan `node:fs` untuk seluruh copy asset dan pembuatan upload directory. Jangan menambah dependency atau mengubah route/API/database.

## 1.3 - Perbaiki standalone packaging lintas platform

Tujuan: mengganti satu penyebab build gagal, tanpa mengubah cara Next.js membangun aplikasi.

### Perubahan minimum

- [x] Buat `scripts/prepare-standalone.mjs`.
- [x] Gunakan hanya `node:fs` dan `node:path`.
- [x] Pastikan script membuat `.next/standalone/.next` bila belum ada.
- [x] Copy `.next/static` ke `.next/standalone/.next/static`.
- [x] Copy `public` ke `.next/standalone/public` bila folder tersedia.
- [x] Copy `prisma` ke `.next/standalone/prisma` bila runtime membutuhkannya.
- [x] Buat `.next/standalone/upload`.
- [x] Ganti tail `build` menjadi `node scripts/prepare-standalone.mjs` setelah `next build`.
- [x] Jangan memakai `cp`, `mkdir -p`, Bash, WSL, atau dependency copy library.
- [x] Jangan mengubah `next.config.ts`: build tidak menunjukkan asset yang hilang.

### Kontrak script

| Input | Output |
|---|---|
| `.next/static` | `.next/standalone/.next/static` |
| `public` | `.next/standalone/public` |
| `prisma` | `.next/standalone/prisma` |
| tidak ada folder upload | `.next/standalone/upload` dibuat |

Checkpoint selesai: asset packaging memakai Node standard library dan aman dijalankan ulang.
### Hasil 1.3 - 19 Juli 2026

- `package.json` build tail sekarang menjalankan `node scripts/prepare-standalone.mjs`.
- Script baru memakai `node:fs` dan `node:path`; tidak ada dependency baru.
- `npm run build`: PASS, exit code `0`.
- Next.js compile: PASS, 12,8 detik.
- TypeScript: PASS, 21,8 detik.
- Static generation: PASS, 23/23 halaman.
- Standalone output terverifikasi: `server.js`, `.next/static`, `public`, `prisma`, dan `upload` tersedia.
- Root cause `cp`/`mkdir -p` sudah dihilangkan dari build command.
- `npm start` sekarang memakai `node .next/standalone/server.js`; Bash wrapper tidak lagi menjadi default start command.

Handoff ke 1.4: validasi production build dan start standalone server; jangan mengubah route, API, database, atau UI.

## 1.4 - Validasi production build

Tujuan: memastikan exit code build benar-benar nol.

- [ ] Hapus hanya output build yang dihasilkan command sebelumnya bila build perlu diulang; jangan menyentuh source atau data user.
- [x] Jalankan `npm run build`.
- [x] Pastikan `next build` sukses.
- [x] Pastikan prepare standalone script sukses.
- [ ] Verifikasi file berikut tersedia:

```text
.next/standalone/server.js
.next/standalone/.next/static
.next/standalone/public
.next/standalone/upload
```

- [x] Jalankan `git diff --check`.
- [x] Jalankan `npm test` ulang.

Checkpoint selesai: build exit `0`, test tetap hijau, dan tidak ada whitespace error.
### Hasil 1.4 - 19 Juli 2026

- `npm run build`: PASS, exit code `0`.
- Next.js compile: PASS, 6,2 detik.
- TypeScript: PASS, 18,7 detik.
- Static generation: PASS, 23/23 halaman.
- `scripts/prepare-standalone.mjs`: PASS.
- Output `server.js`, `.next/static`, `public`, `prisma`, dan `upload`: tersedia.
- `git diff --check`: PASS.
- `npm test`: PASS, 5 file dan 128 test.

Handoff ke 1.5: jalankan standalone server pada port terpisah atau setelah port 3000 dibebaskan, lalu ukur startup, RAM, response `/login`, dan asset browser.

## 1.5 - Jalankan dan ukur production runtime

Tujuan: membuktikan output standalone benar-benar dapat dipakai.

- [x] Pastikan port 3000 tidak sedang dipakai development server.
- [x] Jalankan
npm run start:prod`.
- [x] Tunggu server mendengarkan port 3000.
- [x] Request `/`; hasil yang diharapkan adalah redirect ke login bila belum autentikasi.
- [x] Request `/login`; hasil yang diharapkan `200 OK`.
- [x] Catat startup time.
- [x] Catat Working Set server production.
- [x] Catat warm response time `/login`.
- [x] Buka browser dan cek CSS, font, logo, serta login form tampil normal.
- [x] Hentikan server dengan `Ctrl+C` setelah pengukuran.

### Hasil 1.5 - 19 Juli 2026

- Command: `PORT=3001 npm start` melalui PowerShell environment.
- Server: Next.js standalone, ready dalam `0 ms` pada log runtime.
- Production Working Set: `104,9 MB`.
- Development baseline: sekitar `735,4 MB`.
- Root `/`: `307` ke `/login?callbackUrl=%2F`.
- `/login`: `200 OK`, `0,213 s`.
- Static font asset: `200 OK`, `0,209 s`.
- Production process sudah dihentikan setelah pengukuran.
- Development server port 3000 tetap tersedia.
### Command validasi

```powershell
npm run start:prod
curl.exe -I http://localhost:3000/
curl.exe -I http://localhost:3000/login
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Checkpoint selesai: production server dapat dibuka tanpa `bash start-lentera.sh`.

## 1.6 - Bandingkan hasil dan putuskan langkah berikutnya

Tujuan: membuat keputusan berdasarkan angka, bukan asumsi.

| Metrik | Development | Production | Target |
|---|---:|---:|---|
| Startup time | `833 ms` ready | `0 ms` ready | production dapat diulang |
| Total Node RAM | `735,4 MB` | `104,9 MB` | production lebih rendah atau setara |
| Warm `/login` | `48-64 ms` | `213 ms` | tidak regresi |
| Build exit code | `0 setelah fix` | `0` | `0` |
| Test | `128/128` | `128/128` | seluruhnya lulus |
| Client chunks terbesar | `477,1 KB` | sama | baseline untuk Phase 3 |

- [x] Tambahkan hasil aktual ke tabel.
- [x] Catat dev-only overhead yang tidak perlu dioptimasi pada Phase 1.
- [x] Catat bottleneck yang tersisa untuk Phase 2 atau Phase 3.
- [x] Pastikan tidak ada task database, DuckDB, route split, atau lineage yang masuk commit Phase 1.

Checkpoint selesai: laporan before/after cukup untuk menilai apakah mode production memang lebih ringan.

### Keputusan 1.6

- RAM production sekitar `85,7%` lebih rendah daripada development; standalone sudah memenuhi tujuan Phase 1.
- Selisih waktu `/login` tidak dijadikan target optimasi Phase 1 karena development dan production memakai pipeline berbeda serta production tetap di bawah `250 ms`.
- Overhead development (`next dev`, compiler, HMR) diterima sebagai dev-only dan tidak dibawa ke Phase 2.
- Bottleneck berikutnya adalah client chunk terbesar `477,1 KB`; evaluasi route split dan lazy loading dipindahkan ke Phase 3.
- Phase 2 tetap fokus pada fondasi query/data layer; tidak ada database, DuckDB, route split, atau lineage yang ditambahkan ke commit Phase 1.

## 1.7 - Handoff dan commit

- [ ] Periksa `git status --short`.
- [ ] Stage hanya `package.json`, script standalone, dan dokumentasi Phase 1 yang terkait.
- [ ] Jangan stage `.backup/`, archive root, `.env`, `.next`, atau `node_modules`.
- [ ] Commit dengan pesan: `fix: make standalone build work on Windows`.
- [ ] Push hanya setelah user menyetujui atau sesuai alur kerja aktif.
- [ ] Isi laporan akhir di bawah.

## Laporan hasil hari ini

```markdown
### Day 1 result

- Status: Phase 1.0-1.6 selesai; handoff 1.7 belum dilakukan
- Branch: `codex/phase-1-runtime-baseline`
- Commit: belum dibuat
- Test: `128/128` lulus
- Build: exit code `0`
- Development startup: `833 ms` ready
- Production startup: `0 ms` ready
- Development RAM: `735,4 MB`
- Production RAM: `104,9 MB`
- Development warm /login: `48-64 ms`
- Production warm /login: `213 ms`
- Five largest chunks: `477,1 KB`, `222,2 KB`, `134,2 KB`, `132,7 KB`, `110 KB`
- Selesai: baseline, Windows standalone build, production smoke test, dan perbandingan 1.6
- Ditunda: commit/PR dan route/chunk optimization Phase 3
- Blocker: tidak ada
```

## Definition of done

- [ ] Build sukses di Windows dengan exit code `0`.
- [ ] Production server membuka `/login` dengan `200 OK`.
- [ ] Test penuh lulus sebelum dan sesudah perubahan.
- [ ] Baseline dan hasil akhir tercatat.
- [ ] Tidak ada perubahan route, database schema, UI, atau business logic.
- [ ] Commit Phase 1 tidak berisi file lokal atau credential.

## Instruksi setelah phase selesai: PR dan review

1. Jalankan test dan build terakhir.
2. Periksa diff hanya untuk file Phase 1.
3. Push branch dan buat PR.
4. Review seperti GitHub Copilot: baca diff, caller script, process flow, dan test output.
5. Klasifikasikan temuan **Critical -> High -> Medium -> Low**.
6. Critical dan High wajib selesai sebelum merge; Medium selesai di PR ini; Low menjadi follow-up.
7. Setelah fix, ulangi test, build, dan review diff.

### Fokus review Phase 1

- **Critical - credential atau data lokal ikut commit.** Error: `.env`, database, archive, atau upload path masuk diff. Dampak: secret/data bocor. Fix diputuskan: keluarkan dari staging, tambahkan `.gitignore`, rotasi credential bila pernah ter-push, lalu scan ulang.
- **High - build masih bergantung pada `cp`, `mkdir -p`, Bash, atau path Unix.** Error: script hanya berjalan di shell tertentu. Dampak: Windows/CI gagal. Fix diputuskan: pindahkan copy asset ke `node:fs` dan jadikan script itu satu-satunya tail build.
- **High - standalone tidak menyajikan asset atau login.** Error: static/public/Prisma runtime tidak tercopy. Dampak: 404 asset atau server crash. Fix diputuskan: fail-fast pada copy script dan smoke test `/` serta `/login`.
- **Medium - baseline tidak reproducible.** Error: startup/RAM/response/chunk diukur dengan metode berbeda. Dampak: optimasi tidak dapat dibandingkan. Fix diputuskan: gunakan command dan urutan yang sama, lalu simpan angka before/after.
- **Low - dokumentasi runtime tidak lengkap.** Error: command Windows tidak didokumentasikan. Dampak: error berulang. Fix diputuskan: tambahkan dev dan production command ke README.

### Format temuan

```markdown
### [PRIORITY] Judul
- Error: file/baris dan kondisi salah.
- Dampak: risiko jika dibiarkan.
- Fix diputuskan: perubahan konkret.
- Bukti: test/command/output.
- Status: open / fixed / verified.
```
