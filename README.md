# 📦 Panduan Lengkap Proyek IoT Quality Control (Smart Defect Detection)
**Sistem Deteksi Cacat Dimensi & Ketinggian Barang Berbasis Sensor Ultrasonik HC-SR04 + ESP32**

Sistem Quality Control (QC) otomatis industri berbasis Internet of Things (IoT) yang mengukur ketebalan, ketinggian, dan cacat dimensi barang secara *real-time*. Dilengkapi dengan **Web Dashboard**, **Virtual ESP32 Simulator**, dan integrasi penuh ke **3 Platform Cloud IoT resmi**: **Google Firebase**, **ThingsBoard IoT Platform**, dan **Node-RED**.

---

## 🗂️ 1. Struktur Berkas Proyek

```text
iot-defect-detection/
├── index.html                           # Web Dashboard Antarmuka Monitoring Real-Time
├── style.css                            # Styling UI & Animasi Sonar HC-SR04
├── app.js                               # Engine QC, Chart.js, Dynamic Threshold & Cloud Connectors
├── server.py                            # Server Backend Python Lokal & REST Proxy API
├── thingsboard_dashboard.json           # Template Konfigurasi Dashboard Resmi ThingsBoard Cloud
├── node_red_flow.json                   # Alur Logika Visual & Dashboard Resmi Node-RED
├── esp32_ultrasonic_defect_detector.ino # Firmware C++ ESP32 + HC-SR04 Siap Upload ke Alat Fisik
├── virtual_esp32/
│   └── virtual_esp32.py                 # Simulator Interaktif ESP32 di Terminal (Auto-Sync Kalibrasi)
├── Presentasi_IoT_Quality_Control.pptx  # Slide Presentasi Resmi 10 Slide Widescreen
└── README.md                            # Dokumentasi Panduan Lengkap
```

---

## 🚀 2. Cara Menjalankan Proyek (Web Dashboard & Server)

### Langkah A: Menjalankan Server Lokal
1. Buka terminal **PowerShell** atau Command Prompt di folder proyek:
   ```bash
   python server.py
   ```
2. Server akan aktif di port `3000`.

### Langkah B: Membuka Dashboard di Browser
* Buka browser (**Google Chrome** atau **Microsoft Edge**):
  👉 **`http://localhost:3000`** *(atau buka langsung file `index.html`)*.

---

## 🎮 3. Cara Menjalankan & Menggunakan Virtual ESP32

Jika hardware fisik ESP32 sedang tidak ada di dekatmu, kamu bisa menggunakan **Virtual ESP32 Simulator** yang perilakunya 100% identik dengan alat mikrokontroler aslinya.

1. Buka jendela terminal baru:
   ```bash
   python virtual_esp32/virtual_esp32.py
   ```
2. **Perintah Pengujian:**
   * Ketik angka jarak dalam cm lalu tekan Enter (contoh: ketik `5` untuk barang normal, `2` untuk cacat tebal, `14` untuk cacat penyok/hilang).
   * Ketik `auto` &rarr; Menjalankan simulasi aliran konveyor pabrik otomatis.
   * Ketik `stop` &rarr; Menghentikan aliran otomatis.
   * Ketik `cal 4.0 7.0` &rarr; Mengubah standar toleransi dimensi barang.
3. Setiap data yang kamu input di terminal otomatis disinkronkan ke Web Dashboard, Firebase, dan ThingsBoard!

---

## 🔌 4. Cara Menghubungkan Hardware Fisik ESP32

### Skema Rangkaian Pin:
| Komponen HC-SR04 | Pin ESP32 Dev Module | Keterangan |
| :--- | :--- | :--- |
| **VCC** | **VIN / 5V** | Sumber daya sensor |
| **GND** | **GND** | Ground |
| **Trig (Trigger)** | **GPIO 5 (D5)** | Pemancar gelombang ultrasonik |
| **Echo (Receiver)**| **GPIO 19 (D19)** | Penerima pantulan sonar |
| **LED Biru Onboard** | **GPIO 2** | Indikator fisik (Nyala 1x = Lolos, Kedip 3x = Cacat) |

### ⚡ Cara 1-Klik Menghubungkan ke Web (Web Serial API):
1. Colokkan ESP32 ke port USB laptop dengan kabel data.
2. Pastikan jendela *Serial Monitor* di Arduino IDE sudah ditutup.
3. Di Web Dashboard, klik tombol biru di pojok kanan atas:  
   👉 **`[ 🔌 Sambungkan ESP32 USB ]`**
4. Pilih port COM perangkatmu (misal `COM8` / `CP210x`) &rarr; klik **Connect**.
5. **Selesai!** Status akan berubah hijau (*Hardware ESP32 Terhubung*) dan data fisik sensor langsung mengalir *real-time*.

---

## 🔥 5. Panduan Menghubungkan ke Google Firebase

### A. Pengaturan di Firebase Console (Hanya Sekali):
1. Buka **[console.firebase.google.com](https://console.firebase.google.com/)** dan buat project baru.
2. Masuk ke menu **Build &rarr; Realtime Database** &rarr; klik **Create Database** (pilih lokasi *Singapore / asia-southeast1*).
3. Di tab **Rules**, ubah aturannya agar bisa dibaca-tulis:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
   Lalu klik tombol **Publish**.
4. Salin URL Database yang muncul di bagian atas (contoh: `https://iot-defect-detection-default-rtdb.asia-southeast1.firebasedatabase.app`).

### B. Menghubungkan ke Web Dashboard:
1. Di header Web Dashboard, klik tombol **`[ 🔥 Firebase: Standalone ]`**.
2. Paste URL Database tadi ke kolom **Firebase Database URL**.
3. Klik tombol **`Hubungkan Cloud Mode`** &rarr; status tombol di header akan berubah menjadi **`Firebase: Realtime Cloud`** (Aktif).

---

## 🌐 6. Panduan Menghubungkan ke ThingsBoard IoT Platform

### A. Membuat Device di ThingsBoard Cloud:
1. Daftar/masuk ke akun gratis di **[thingsboard.cloud](https://thingsboard.cloud/)**.
2. Di menu sebelah kiri, buka **Entities &rarr; Devices** &rarr; klik tombol **`+` (Add Device)**.
3. Beri nama perangkat: `esp32-qc` &rarr; klik **Add**.
4. Buka perangkat tersebut, di tab **Details** klik tombol **Copy Access Token**.

### B. Menghubungkan ke Web Dashboard:
1. Di header Web Dashboard, klik tombol **`[ 🌐 ThingsBoard: Standalone ]`**.
2. Paste token tadi ke kotak **Device Access Token**.
3. Klik tombol **`Aktifkan Stream ThingsBoard`**.
4. Klik tombol hijau **`[ 🚀 Kirim 1 Data Uji Coba Telemetri ]`** untuk mengaktifkan status perangkat menjadi **Active**.

### C. Menampilkan Dashboard Visual di ThingsBoard:
1. Di menu sebelah kiri ThingsBoard, klik **Dashboards** &rarr; klik icon **`+`** &rarr; pilih **`Import dashboard`**.
2. Pilih file **`thingsboard_dashboard.json`** yang ada di folder proyek ini.
3. Hubungkan alias ke perangkat `esp32-qc` kamu & klik **Save**. Seluruh grafik dan gauge visual akan langsung aktif!

---

## 🔴 7. Panduan Menghubungkan ke Node-RED

1. Buka terminal baru dan jalankan Node-RED:
   ```bash
   npx node-red
   ```
2. Buka browser dan akses editor alur Node-RED:
   👉 **`http://localhost:1880`**
3. Klik tombol menu (tiga garis di pojok kanan atas) &rarr; pilih **Import** &rarr; pilih **select a file to import**.
4. Pilih file **`node_red_flow.json`** dari folder proyek ini &rarr; klik **Import** &rarr; klik tombol merah **Deploy**.
5. Buka tampilan dashboard visual Node-RED di:
   👉 **`http://localhost:1880/ui`**

---

## 🎛️ 8. Fitur Kalibrasi Ambang Batas Kualitas Dinamis (Dynamic Thresholding)

Operator pabrik dapat mengkalibrasi standar toleransi barang secara fleksibel tanpa mematikan alat:
* **Slider Batas Min OK (Default: `4.0 cm`):** Jika pembacaan sensor `<` nilai ini &rarr; Barang dinyatakan **Cacat Tebal / Menonjol**.
* **Slider Batas Max OK (Default: `7.0 cm`):** Jika pembacaan sensor `>` nilai ini &rarr; Barang dinyatakan **Cacat Penyok / Hilang**.
* **Rentang Antara Min & Max:** Barang dinyatakan **Lolos (PASS)**.
* **Tombol Preset Cepat:** Kecil (`3-5cm`), Sedang (`4-7cm`), Besar (`6-10cm`).
* Kalibrasi yang diubah di web otomatis disinkronkan ke Virtual ESP32 dan seluruh modul analitik secara *real-time*.

---

## 🗑️ 9. Cara Mengosongkan & Mereset Data (Wipe Cloud Data)

* **Di Web & Firebase:** Klik tombol **`[ 🔄 Reset Data ]`** di bagian bawah web &rarr; pilih **`🔥 Hapus & Kosongkan Data Real (Firebase Cloud & ThingsBoard)`**. Seluruh rekaman di web dan Firebase akan kembali bersih ke 0 / `null`.
* **Di ThingsBoard:** Buka menu **Entities &rarr; Devices &rarr; Latest telemetry**, centang kotak checkbox paling atas &rarr; klik icon **Tempat Sampah 🗑️** &rarr; konfirmasi **Delete**.
