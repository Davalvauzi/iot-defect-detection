# 📦 Proyek IoT Quality Control: Deteksi Cacat Barang (Sensor Infrared)

Sistem inspeksi otomatis berbasis IoT (*Quality Control*) untuk mendeteksi barang cacat/abnormal menggunakan **Sensor Infrared (IR Proximity / TCRT5000)** dan memvisualisasikan data secara *real-time* pada **Web & Mobile Dashboard**.

Proyek ini telah dilengkapi **Simulator Interaktif di Web** sehingga kamu bisa langsung menguji tampilan, animasi konveyor, suara alarm, grafik kualitas, dan ekspor data hari ini sebelum komponen fisik tiba besok!

---

## 🗂️ Struktur File Proyek

```
iot-defect-detection/
│
├── index.html                  # Halaman Web & Mobile Dashboard
├── style.css                   # Custom styling, animasi konveyor & efek laser IR
├── app.js                      # Engine simulator data, Chart.js, audio sintetis & state
├── esp32_ir_defect_detector.ino # Kode firmware Arduino/ESP32 siap upload
├── server.py                   # Server Python lokal (opsional untuk REST API ESP32)
└── README.md                   # Panduan lengkap penggunaan & wiring
```

---

## 🚀 Cara Menjalankan & Menguji Dashboard Hari Ini (Mode Simulasi)

### Cara 1: Langsung Buka di Browser (Paling Mudah)
1. Buka File Explorer dan masuk ke:
   `C:\Users\ReX\.gemini\antigravity\scratch\iot-defect-detection\`
2. Klik ganda file **`index.html`** untuk membukanya di browser (Google Chrome, Edge, Firefox, dll.).

### Cara 2: Menjalankan dengan Server Python
1. Buka terminal/PowerShell di folder proyek:
   ```bash
   cd C:\Users\ReX\.gemini\antigravity\scratch\iot-defect-detection
   python server.py
   ```
2. Buka browser di laptop atau HP:
   - **Laptop:** `http://localhost:3000`
   - **HP / Mobile Monitoring:** `http://<IP_LAPTOP_KAMU>:3000` (Pastikan HP dan laptop terhubung ke WiFi yang sama).

---

## 🎮 Fitur Simulator pada Dashboard

1. **Tambah Barang Lolos (Pass):**
   - Menstimulasikan barang normal yang melewati sensor.
   - Sinar sensor menyala hijau, bunyi beep pendek, angka counter & persentase lolos bertambah, dan log tercatat.
2. **Tambah Barang Cacat (Defect):**
   - Menstimulasikan barang dengan cacat permukaan/goresan/warna abnormal.
   - Sinar sensor menyala merah berkedip, alarm buzzer berbunyi, angka cacat bertambah, dan tindakan *Reject* tercatat di tabel.
3. **Mode Auto Simulasi (Aliran Otomatis):**
   - Menjalankan aliran barang otomatis layaknya konveyor pabrik sungguhan.
   - Kecepatan aliran dan probabilitas cacat (% Defect Rate) dapat diatur secara *real-time* dengan slider.
4. **Input Kustom:**
   - Masukkan ID produk custom, tipe kecacatan spesifik, dan nilai ADC sensor manual.
5. **Visualisasi Data Real-Time:**
   - **Doughnut Chart:** Rasio persentase Lolos vs Cacat.
   - **Line Chart:** Tren fluktuasi sinyal pantulan sensor IR per barang.
6. **Export Data:**
   - Tombol **Export CSV** untuk mengunduh seluruh riwayat inspeksi dalam format Excel/CSV.

---

## 🔌 Panduan Perakitan Hardware (Untuk Besok)

### Daftar Komponen yang Dibutuhkan:
1. **ESP32 DevKit V1** (atau ESP8266 NodeMCU)
2. **Sensor Infrared Proximity / Obstacle** (misal TCRT5000 atau FC-51)
3. **Buzzer Aktif 5V**
4. **LED Merah** (Indikator Cacat) & **LED Hijau** (Indikator Normal) + Resistor 220Ω
5. **Servo Motor SG90** (Opsional: lengan mekanik penyortir/rejector barang)
6. Breadboard & Kabel Jumper

### Skema Pinout ESP32:

| Komponen | Pin Komponen | Pin ESP32 | Keterangan |
| :--- | :--- | :--- | :--- |
| **Sensor IR** | VCC | 3.3V / 5V | Tegangan Positif |
| | GND | GND | Ground |
| | DO (Digital Out) | **GPIO 4** | Deteksi keberadaan objek (0/1) |
| | AO (Analog Out) | **GPIO 34** | Deteksi intensitas pantulan/cacat |
| **Buzzer** | VCC (+) | **GPIO 18** | Bunyi indikator / alarm |
| | GND (-) | GND | Ground |
| **LED Hijau** | Anoda (+) | **GPIO 21** | Indikator barang lolos (Pass) |
| | Katoda (-) | GND (via 220Ω) | Ground |
| **LED Merah** | Anoda (+) | **GPIO 19** | Indikator barang cacat (Defect) |
| | Katoda (-) | GND (via 220Ω) | Ground |
| **Servo SG90** | PWM Signal (Oranye) | **GPIO 13** | Kontrol lengan sortir |
| | VCC (Merah) | 5V (VIN) | Daya Servo |
| | GND (Cokelat) | GND | Ground |

---

## 💻 Langkah Upload Program ke ESP32 (Besok)

1. Buka aplikasi **Arduino IDE**.
2. Buka file `esp32_ir_defect_detector.ino`.
3. Buka menu **Tools &rarr; Board &rarr; ESP32 Arduino &rarr; ESP32 Dev Module**.
4. Jika menggunakan servo, pastikan library `ESP32Servo` sudah terinstall (di Sketch &rarr; Include Library &rarr; Manage Libraries &rarr; cari *ESP32Servo*).
5. Sesuaikan variabel WiFi pada baris 20-21:
   ```cpp
   const char* ssid = "NAMA_WIFI_KAMU";
   const char* password = "PASSWORD_WIFI_KAMU";
   const char* serverUrl = "http://IP_LAPTOP_KAMU:3000/api/inspection";
   ```
6. Hubungkan ESP32 ke laptop via kabel USB, pilih Port COM yang sesuai, lalu klik tombol **Upload (Panah Kanan)**.
7. Buka **Serial Monitor** pada baudrate `115200` untuk memantau data pembacaan sensor secara live.
