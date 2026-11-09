# Clipper: Setup di VPS

## Alur (dibagi dua tempat)
**VPS (dashboard): input dan pemilihan momen**
`inbox/` (video mentah / link) → Whisper.cpp (transkrip per kata) → Claude Code (`claude -p`, memilih momen sesuai **brief**) → **rencana momen** (`work/<id>/plan.json`) + video asli disimpan di `library/`

**PC lokal: editing**
`npm run local` mengambil rencana + video asli dari dashboard → FFmpeg (potong) → Remotion (9:16 + caption + judul + B-roll) → `output/<nama-video>/clip_XX.mp4` di PC Anda

Render tidak dikerjakan VPS, jadi VPS tidak perlu Chrome/Remotion untuk render dan tidak terbebani CPU/RAM-nya.

## Render di PC lokal
1. Di PC: `git clone` proyek, `npm install`, pasang FFmpeg (harus ada di PATH). Untuk kamera pintar (face tracking) pasang juga Python dengan dependensi di `scripts/faces.py`; tanpa itu render memakai layout blur biasa.
2. Buat berkas `.env.local` di folder proyek (tidak ikut git):
   ```
   CLIPPER_URL=http://IP_VPS:8080
   CLIPPER_PASSWORD=password_dashboard
   ```
3. Jalankan:
   ```bash
   npm run local            # render semua rencana yang belum dirender
   npm run local -- --list  # lihat daftar rencana
   npm run local -- <id>    # render satu rencana (boleh diulang)
   npm run local -- --no-upload   # render tanpa mengirim klip jadi ke dashboard
   ```
   Video asli diunduh sekali ke `work/<id>/`, hasil ada di `output/<id>/`. Klip jadi ikut diunggah ke dashboard (tanpa `--no-upload`), lalu rencana ditandai "Sudah dirender". Kalau unggahan gagal, klip tetap aman di `output/<id>/`.

Di dashboard, meja Miu menampilkan rencana momen: pratinjau video asli, daftar momen (waktu, skor, alasan sesuai brief) dan tombol Putar untuk mengecek tiap momen. Tiap momen punya:
- **Unduh klip**: klip jadi hasil edit di PC lokal. Sebelum dirender, tombolnya menjadi **Unduh potongan mentah** (dipotong dari video asli tanpa editing, dibuat server saat pertama diminta).
- **Unduh skrip**: berkas `.txt` berisi judul, waktu, alasan, kata penting, dan teks ucapan klip itu.
- **Lihat isi klip**: teks ucapan klip ditampilkan langsung di dashboard.

Video di meja Aoi tidak langsung terkirim saat dipilih: file masuk daftar dulu, baru dikirim setelah tombol **Upload** ditekan. Menghapus rencana juga menghapus video asli, klip jadi, dan potongan mentahnya di VPS.

## 1. Prasyarat di VPS (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y ffmpeg build-essential cmake git curl
# Node 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
# Dependensi Chrome untuk Remotion
sudo apt install -y libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libgbm-dev libatk-bridge2.0-0 libcups2
# Claude Code (login sekali dengan: claude)
npm i -g @anthropic-ai/claude-code && claude
```
Spesifikasi disarankan: min 4 vCPU, 8 GB RAM. Model Whisper `small` cukup; ganti dengan `WHISPER_MODEL=medium` untuk akurasi lebih baik (lebih lambat).

## 2. Pasang proyek
```bash
git clone <repo-anda> clipper && cd clipper
npm install
```

## 3. Pemakaian
Satu video manual (semua tahap termasuk render di mesin yang sama):
```bash
npm run clip -- inbox/video.mp4
```
Otomatis (pantau folder inbox):
```bash
npm run watch
```
Letakkan video lewat desktop VPS (atau drag ke folder `inbox/`) → rencana momen jadi di dashboard. Video yang selesai dipindah ke `library/`, yang gagal ke `inbox/failed/`.

Jalankan terus di background dengan pm2:
```bash
npm i -g pm2 && pm2 start "npm run watch" --name clipper && pm2 save && pm2 startup
```

## Dashboard web (upload dan unduh lewat browser)
```bash
pm2 start "APP_PASSWORD=GANTI_PASSWORD_KUAT npm run server" --name clipper-ui && pm2 save
```
Buka `http://IP_VPS:8080` di browser, login dengan username bebas dan password tadi. Seret video ke halaman (isi brief agar Claude memilih momen yang tepat), lalu pantau status dan lihat rencana momen di sana.

- **Unduh dari link:** tempel link YouTube, Google Drive (file publik, "Siapa saja yang memiliki link"), atau link video langsung di kolom link. Server mengunduh dengan `yt-dlp` dan memasukkannya ke antrean otomatis. Pasang `yt-dlp` di VPS dulu:
  ```bash
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  yt-dlp --version
  ```
  Perbarui secara berkala dengan `sudo yt-dlp -U`, karena YouTube sering berubah. Kalau YouTube menolak dengan pesan "Sign in to confirm you're not a bot" (umum pada IP VPS), ekspor cookie browser ke file `cookies.txt`, lalu jalankan server dengan `YTDLP_COOKIES=/path/cookies.txt`. Unduh hanya video yang Anda punya hak memakainya.
- Port 8080 harus dibuka di firewall VPS (`sudo ufw allow 8080`).
- Server ini memakai HTTP biasa, jadi password terkirim tanpa enkripsi. Untuk keamanan lebih, akses lewat SSH tunnel: `ssh -L 8080:localhost:8080 user@IP_VPS`, lalu buka `http://localhost:8080`, atau pasang Caddy/Nginx dengan HTTPS di depannya.
- Ganti port dengan `PORT=9000`.
- Dashboard hanya antarmuka. Pemrosesannya tetap dikerjakan watcher (`clipper`), jadi kedua proses PM2 harus berjalan.

## Editing otomatis: kamera pintar, B-roll, caption
Setiap klip diproses seperti editor short-form:
- **Kamera pintar:** wajah dideteksi (OpenCV YuNet), gerak mulut menentukan siapa yang bicara, dan Remotion menggeser serta men-zoom kamera ke pembicara itu (potongan tegas + punch-in saat berganti, dentuman zoom pada kata penting). Jika wajah tidak terdeteksi (misal rekaman layar), dipakai tata letak latar blur.
- **B-roll animasi:** Claude memilih momen dan jenisnya (ikon, angka besar, banner keyword, cutaway layar penuh). Semuanya digambar Remotion, tanpa stok video.
- **Caption bergaya:** font Google (Montserrat, Anton), kata aktif disorot, kata penting dipertegas. Tersedia tiga gaya: Pop, Kotak, Bersih.
- **Judul hook** di awal klip dan bilah progres tipis.

Lingkungan analisis wajah dipasang sekali di folder proyek (tidak menyentuh sistem):
```bash
cd ~/clipper
python3 -m venv .venv
./.venv/bin/pip install opencv-python-headless numpy
```
Model wajah (`models/face_detection_yunet_2023mar.onnx`, 232 KB) sudah ikut di repo. Tanpa lingkungan ini, pipeline tetap jalan dan memakai tata letak latar blur. Ukuran terukur di VPS 4 vCPU: analisis wajah sekitar 8 detik per klip 30 detik, render sekitar 5 menit per klip 40 detik.

Brief, jumlah klip, durasi, dan gaya diisi di jendela ruang Aoi sebelum mengunggah. Pengaturan disimpan di browser dan berlaku untuk video yang dikirim setelahnya.

## Pengaturan (environment variable)
| Variabel | Default | Fungsi |
|---|---|---|
| `WHISPER_MODEL` | `base` | tiny / base / small / medium / large-v3. Lebih besar = lebih akurat tapi jauh lebih lambat |
| `WHISPER_BEAM` | `1` | 1 = greedy (cepat); 5 = beam search (lebih akurat, sekitar 3x lebih lambat) |
| `WHISPER_THREADS` | `4` | jumlah thread CPU untuk Whisper |
| `WHISPER_LANGUAGE` | `id` | kode bahasa audio (`en`, dll.) |
| `MIN_CLIP_SEC` / `MAX_CLIP_SEC` | 25 / 75 | rentang durasi klip |
| `MAX_CLIPS` | 6 | jumlah klip maksimum per video |
| `CLIP_LAYOUT` | `blur-fit` | `cover` = crop tengah, `blur-fit` = video utuh + latar blur (dibuat FFmpeg) |
| `RENDER_CONCURRENCY` | 3 | jumlah proses render Remotion paralel (dipakai saat render di PC lokal) |
| `HEAVY_EXCLUSIVE` | 1 | 1 = transkripsi dan render bergantian (aman untuk RAM kecil); 0 = boleh bersamaan |
| `MAX_INFLIGHT` | 3 | jumlah video yang boleh berjalan di pipeline sekaligus |
| `MIN_FREE_MB` | 900 | tahap berat menunggu sampai RAM bebas sedikitnya sebesar ini |

Contoh mengubah pengaturan di PM2: `WHISPER_MODEL=small pm2 restart clipper --update-env && pm2 save`

## Kinerja terukur (VPS 4 vCPU "Common KVM", RAM 3,8 GB, tanpa GPU)
Video wawancara 130 detik (landscape 1080p, bahasa Indonesia):
- Transkripsi: model `base` + greedy ≈ 6 menit (sekitar 2,7x durasi video). Model `small` + beam 5 ≈ 20 menit untuk video 2 menit, jadi tidak layak untuk video panjang.
- Claude memilih klip: sekitar 25 detik.
- Menyiapkan 3 klip dengan FFmpeg: sekitar 1,5 menit.
- Render Remotion: sekitar 3,5 menit per klip 30 detik.

Artinya video 1 jam butuh transkripsi sekitar 2,5 jam di VPS ini. Untuk video panjang, pertimbangkan VPS dengan CPU lebih kuat atau layanan transkripsi eksternal.

## Memperbarui ke versi terbaru
```bash
cd ~/clipper && git checkout -- package-lock.json && git pull origin master && npm install --no-package-lock && pm2 restart all
```
Pastikan tidak ada video yang sedang diproses saat restart (video yang terputus kembali ke antrean dan diproses ulang dari awal).

## Tahapan bisa diulang
Hasil tiap tahap disimpan di `work/<nama-video>/` (`captions.json`, `clips.json`). Untuk memilih ulang klip, hapus `clips.json`; edit manual juga bisa sebelum render ulang.

## Desain visual
Edit `src/ClipVideo.tsx` (font, warna, posisi caption) dan lihat hasilnya dengan `npm run dev`.
