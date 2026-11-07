# Clipper: Setup di VPS

## Alur
`inbox/` (video mentah) → FFmpeg → Whisper.cpp (transkrip per kata) → Claude Code (`claude -p`, memilih klip) → FFmpeg (potong) → Remotion (9:16 + caption + judul) → `output/<nama-video>/clip_XX.mp4`

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
Satu video manual:
```bash
npm run clip -- inbox/video.mp4
```
Otomatis (pantau folder inbox):
```bash
npm run watch
```
Letakkan video lewat desktop VPS (atau drag ke folder `inbox/`) → klip jadi di `output/`. File yang selesai dipindah ke `inbox/done/`, yang gagal ke `inbox/failed/`.

Jalankan terus di background dengan pm2:
```bash
npm i -g pm2 && pm2 start "npm run watch" --name clipper && pm2 save && pm2 startup
```

## Dashboard web (upload dan unduh lewat browser)
```bash
pm2 start "APP_PASSWORD=GANTI_PASSWORD_KUAT npm run server" --name clipper-ui && pm2 save
```
Buka `http://IP_VPS:8080` di browser, login dengan username bebas dan password tadi. Seret video ke halaman, lalu pantau status, putar hasilnya, dan unduh klip di sana.

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

## Pengaturan (environment variable)
| Variabel | Default | Fungsi |
|---|---|---|
| `WHISPER_MODEL` | `small` | tiny / base / small / medium / large-v3 |
| `WHISPER_LANGUAGE` | `id` | kode bahasa audio (`en`, dll.) |
| `MIN_CLIP_SEC` / `MAX_CLIP_SEC` | 25 / 75 | rentang durasi klip |
| `MAX_CLIPS` | 6 | jumlah klip maksimum per video |
| `CLIP_LAYOUT` | `blur-fit` | `cover` = crop tengah, `blur-fit` = video utuh + latar blur |

## Tahapan bisa diulang
Hasil tiap tahap disimpan di `work/<nama-video>/` (`captions.json`, `clips.json`). Untuk memilih ulang klip, hapus `clips.json`; edit manual juga bisa sebelum render ulang.

## Desain visual
Edit `src/ClipVideo.tsx` (font, warna, posisi caption) dan lihat hasilnya dengan `npm run dev`.
