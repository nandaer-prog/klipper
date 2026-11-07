"""
Analisis wajah dan pembicara aktif untuk satu klip video.

Pemakaian: python faces.py <video> <hasil.json> [mulai_detik akhir_detik]

Langkah:
1. Deteksi wajah (YuNet) pada ~6 frame per detik.
2. Kelompokkan deteksi menjadi "orang" berdasarkan posisi (track).
3. Ukur gerak mulut tiap orang (selisih piksel di area mulut antar sampel).
4. Orang dengan gerak mulut terbesar dianggap sedang bicara, lalu dibentuk "shot".
"""
import json
import os
import sys

import cv2
import numpy as np

SAMPLE_FPS = 6.0
DET_WIDTH = 640
MIN_PRESENCE = 0.15   # track harus muncul di sedikitnya 15% sampel
MIN_SHOT_SEC = 1.6    # shot lebih pendek dari ini digabung agar tidak berkedip
SWITCH_RATIO = 1.35   # penantang harus lebih aktif sekian kali dari pembicara saat ini
MIN_ENERGY = 1.2      # di bawah ini dianggap tidak ada gerak bicara

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "face_detection_yunet_2023mar.onnx")


def main(video, out, start=0.0, end=0.0):
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise SystemExit("Tidak bisa membuka video")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if end > start:
        duration = end - start
        cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000.0)
    else:
        duration = total / fps if total > 0 else 0.0
    max_frames = int(duration * fps) + 1

    dw = DET_WIDTH if W > DET_WIDTH else W
    dh = int(round(H * dw / W))
    scale = W / dw
    det = cv2.FaceDetectorYN.create(MODEL, "", (dw, dh), 0.7, 0.3, 20)

    step = max(1, int(round(fps / SAMPLE_FPS)))
    samples = []  # tiap sampel: waktu + daftar deteksi
    prev_gray = None
    idx = 0
    while idx < max_frames:
        ok = cap.grab()
        if not ok:
            break
        if idx % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            small = cv2.resize(frame, (dw, dh)) if dw != W else frame
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            det.setInputSize((dw, dh))
            _, faces = det.detect(small)
            dets = []
            if faces is not None:
                for f in faces:
                    x, y, w, h = [float(v) for v in f[:4]]
                    if w < dw * 0.05:
                        continue  # wajah terlalu kecil (latar belakang)
                    mouth = ((f[10] + f[12]) / 2.0, (f[11] + f[13]) / 2.0)
                    mw = max(abs(f[12] - f[10]), w * 0.3)
                    dets.append({"x": x, "y": y, "w": w, "h": h, "mx": float(mouth[0]), "my": float(mouth[1]), "mw": float(mw)})
            energies = []
            for d in dets:
                x0 = int(max(0, d["mx"] - d["mw"] * 0.8))
                x1 = int(min(dw, d["mx"] + d["mw"] * 0.8))
                y0 = int(max(0, d["my"] - d["mw"] * 0.5))
                y1 = int(min(dh, d["my"] + d["mw"] * 0.7))
                if prev_gray is not None and x1 - x0 > 3 and y1 - y0 > 3:
                    a = cv2.resize(gray[y0:y1, x0:x1], (24, 16)).astype(np.float32)
                    b = cv2.resize(prev_gray[y0:y1, x0:x1], (24, 16)).astype(np.float32)
                    energies.append(float(np.abs(a - b).mean()))
                else:
                    energies.append(0.0)
            samples.append({"t": idx / fps, "dets": dets, "energy": energies})
            prev_gray = gray
        idx += 1
    cap.release()

    # --- kelompokkan deteksi menjadi track berdasarkan posisi tengah wajah ---
    tracks = []  # {cx, cy, items:[(sample_index, det_index)]}
    thresh = dw * 0.18
    for si, s in enumerate(samples):
        used = set()
        for di, d in enumerate(s["dets"]):
            cx = d["x"] + d["w"] / 2
            cy = d["y"] + d["h"] / 2
            best, bd = None, 1e9
            for ti, t in enumerate(tracks):
                if ti in used:
                    continue
                dist = abs(t["cx"] - cx) + abs(t["cy"] - cy) * 0.5
                if dist < thresh and dist < bd:
                    best, bd = ti, dist
            if best is None:
                tracks.append({"cx": cx, "cy": cy, "items": [(si, di)]})
                used.add(len(tracks) - 1)
            else:
                t = tracks[best]
                t["cx"], t["cy"] = 0.7 * t["cx"] + 0.3 * cx, 0.7 * t["cy"] + 0.3 * cy
                t["items"].append((si, di))
                used.add(best)

    n = max(1, len(samples))
    tracks = [t for t in tracks if len(t["items"]) / n >= MIN_PRESENCE]
    tracks.sort(key=lambda t: t["cx"])  # urut kiri ke kanan
    face_ratio = len({si for t in tracks for si, _ in t["items"]}) / n

    out_tracks = []
    for ti, t in enumerate(tracks):
        pts = []
        for si, di in t["items"]:
            d = samples[si]["dets"][di]
            pts.append({
                "t": round(samples[si]["t"], 3),
                "x": round(d["x"] * scale, 1), "y": round(d["y"] * scale, 1),
                "w": round(d["w"] * scale, 1), "h": round(d["h"] * scale, 1),
                "e": round(samples[si]["energy"][di], 3),
            })
        out_tracks.append({"id": ti, "samples": pts})

    # --- pembicara aktif per sampel ---
    # energi gerak mulut dihaluskan (rata-rata 3 sampel ~0,5 dtk) per track
    smooth = []
    for tr in out_tracks:
        e = {round(p["t"], 3): p["e"] for p in tr["samples"]}
        ts = [s["t"] for s in samples]
        arr = np.array([e.get(round(t, 3), 0.0) for t in ts], dtype=np.float32)
        k = np.ones(3, dtype=np.float32) / 3
        smooth.append(np.convolve(arr, k, mode="same"))

    speaker = []
    current = 0 if out_tracks else -1
    for si in range(len(samples)):
        if not out_tracks:
            speaker.append(-1)
            continue
        vals = [float(smooth[ti][si]) for ti in range(len(out_tracks))]
        best = int(np.argmax(vals))
        if best != current and vals[best] > MIN_ENERGY and vals[best] > vals[current] * SWITCH_RATIO:
            current = best
        speaker.append(current)

    # --- ubah menjadi shot, gabungkan shot yang terlalu pendek ---
    shots = []
    for si, sp in enumerate(speaker):
        t0 = samples[si]["t"]
        if shots and shots[-1]["track"] == sp:
            continue
        shots.append({"start": t0, "track": sp})
    for i, sh in enumerate(shots):
        sh["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else duration
    merged = []
    for sh in shots:
        if merged and (sh["end"] - sh["start"] < MIN_SHOT_SEC):
            merged[-1]["end"] = sh["end"]  # perpanjang shot sebelumnya
        else:
            merged.append(dict(sh))
    # gabungkan shot bertetangga dengan track sama
    final = []
    for sh in merged:
        if final and final[-1]["track"] == sh["track"]:
            final[-1]["end"] = sh["end"]
        else:
            final.append(sh)
    if final:
        final[0]["start"] = 0.0
    for sh in final:
        sh["start"] = round(sh["start"], 3)
        sh["end"] = round(sh["end"], 3)

    result = {
        "width": W, "height": H, "fps": fps, "duration": round(duration, 3),
        "sampleFps": SAMPLE_FPS, "faceRatio": round(face_ratio, 3),
        "tracks": out_tracks, "shots": final,
    }
    with open(out, "w") as f:
        json.dump(result, f)
    print(json.dumps({"faceRatio": result["faceRatio"], "tracks": len(out_tracks), "shots": len(final)}))


if __name__ == "__main__":
    if len(sys.argv) not in (3, 5):
        raise SystemExit("Pemakaian: python faces.py <video> <hasil.json> [mulai_detik akhir_detik]")
    if len(sys.argv) == 5:
        main(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
    else:
        main(sys.argv[1], sys.argv[2])
