---
name: clip-editor
description: Mengedit klip pendek 9:16 (caption, judul hook, B-roll, kamera pintar) dengan Remotion di proyek Clipper ini, dan merender rencana momen yang dipilih Claude di dashboard. Pakai saat diminta mengubah tampilan klip, gaya caption, B-roll, atau merender ulang klip.
---

# Mengedit klip di proyek Clipper

## Pembagian kerja
- **VPS/dashboard**: input video, transkrip, dan Claude memilih momen sesuai brief -> `work/<id>/plan.json`. JANGAN mengubah logika ini kecuali diminta.
- **PC lokal (di sini)**: editing dan render dengan Remotion. Ini wilayah skill ini.

## Alur merender
1. Pastikan `.env.local` berisi `CLIPPER_URL` dan `CLIPPER_PASSWORD`.
2. `npm run local -- --list` melihat rencana; `npm run local` render yang belum; `npm run local -- <id>` render ulang satu rencana.
3. Hasil: `output/<id>/clip_XX.mp4`. Video asli dan transkrip diunduh ke `work/<id>/`.
4. Setelah mengubah kode tampilan, selalu jalankan `npm run lint` (eslint + tsc) sebelum merender.

## Peta kode (semua di `src/`)
- `types.ts`: `ClipProps` (src, mode, camera, captions, emphasis, captionStyle, title, hook, broll, durationInSeconds, accent). Ubah bentuk props di sini dulu, lalu sesuaikan `scripts/render-clips.ts`.
- `Root.tsx`: satu komposisi `Clip`, 1080x1920, 30 fps, durasi dari `durationInSeconds`.
- `ClipVideo.tsx`: menyusun video, kamera, caption, hook, B-roll.
- `Captions.tsx`: gaya caption `pop` | `box` | `clean`. Kata dikelompokkan per halaman (jeda 650 ms, `createTikTokStyleCaptions`) dan muncul dengan `spring`. Kata yang sedang diucapkan disorot: di `box` latarnya `accent` dengan teks gelap, di `pop`/`clean` warnanya `accent`. Kata di `emphasis` (dicocokkan setelah huruf kecil dan tanpa tanda baca): di `box` latar pink `rgba(255,61,141,.92)`, di `pop`/`clean` teks pink `#FF3D8D` dengan skala 1,16. Warna aksen bawaan `#FFE600` ada di `types.ts`.
- `Hook.tsx`: judul di awal klip (sekitar 3 detik pertama; B-roll dimulai setelahnya).
- `BRoll.tsx` + `Icons.tsx`: animasi `icon` | `stat` | `keyword` | `scene`; ikon dari daftar `ICONS` di `types.ts`.
- `scripts/camera.ts` + `scripts/faces.py`: face tracking dan pindah POV (mode `camera`); jika gagal, mode `composite` (latar blur dari FFmpeg, di `render-clips.ts`).
- `scripts/captions.ts`: pembersih tanda baca hasil Whisper.

## Aturan Remotion (wajib)
- Semua animasi digerakkan `useCurrentFrame()` / `interpolate` / `spring`. Dilarang CSS transition/animation dan `setTimeout`.
- Video lewat `<OffthreadVideo>` atau komponen video Remotion, bukan `<video>`. File dari `public/` lewat `staticFile`.
- Waktu caption dan B-roll relatif terhadap awal klip (detik di B-roll, milidetik di caption).
- Hindari efek berat (blur CSS besar, banyak layer) karena render di CPU; blur latar memang sengaja dibuat FFmpeg.
- Detail teknik: baca skill `remotion-best-practices` dan turunannya (`remotion-captions`, `remotion-markup`, `remotion-render`).

## Cara bekerja
1. Baca file yang relevan dulu; jangan mengubah dari ingatan.
2. Ubah sekecil mungkin, ikuti gaya kode yang ada (komentar dan teks UI berbahasa Indonesia).
3. Jalankan `npm run lint`. Untuk melihat hasil, `npm run dev` (Remotion Studio) atau render lewat `npm run local -- <id>`.
4. Laporkan apa yang diubah dan apa yang BELUM diverifikasi (misal belum dirender).
5. Perubahan tampilan berlaku untuk semua klip berikutnya; jika hanya satu klip yang diminta, bilang jelas bahwa render ulang akan mengulang seluruh rencana.
