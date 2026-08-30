# 🤖 Virtual ESP32 HC-SR04 Simulator

Simulator mikrokontroler ESP32 virtual berbasis terminal Python yang mereplikasi logika sensor ultrasonik HC-SR04, evaluasi kualitas (PASS / DEFECT), dan pengiriman data via REST API / HTTP POST JSON ke dashboard IoT.

---

## 🚀 Cara Menjalankan

### Langkah 1: Jalankan Server Lokal (Jika belum aktif)
Buka terminal pertama di root folder proyek:
```bash
cd C:\Users\ReX\.gemini\antigravity\scratch\iot-defect-detection
python server.py
```
*(Buka juga `http://localhost:3000` di browser untuk melihat dashboard realtime)*

---

### Langkah 2: Jalankan Virtual ESP32
Buka terminal kedua di subfolder `virtual_esp32`:
```bash
cd C:\Users\ReX\.gemini\antigravity\scratch\iot-defect-detection\virtual_esp32
python virtual_esp32.py
```

---

## 🎮 Pilihan Perintah di Terminal

| Perintah | Fungsi | Hasil Evaluasi |
| :--- | :--- | :--- |
| `5.5` *(atau angka jarak lain)* | Set jarak pantulan sensor manual dalam cm | Otomatis dihitung sesuai kalibrasi aktif |
| `r` atau `refresh` | **Refresh & sinkronkan ulang** batas mutu dari Web secara instan | Update zona PASS aktif |
| `cal min max` | Ubah batas mutu dari terminal (misal: `cal 1.0 3.0`) | Sync ke Web Dashboard |
| `p` | Kirim sampel **Barang Lolos (Normal)** | `PASS` (sesuai zona aktif) |
| `d` | Kirim sampel **Barang Cacat (Penyok/Tebal)** | `DEFECT` (di luar zona aktif) |
| `s` | Mode **Standby** (tidak ada barang melintas) | Jarak > 20 cm |
| `auto` | Jalankan **Aliran Konveyor Otomatis** | Menghasilkan aliran barang acak terus menerus *(tekan Enter untuk stop)* |
| `q` | Matikan Virtual ESP32 | Keluar dari program |
