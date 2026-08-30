#!/usr/bin/env python3
"""
==============================================================================
   VIRTUAL ESP32 - HC-SR04 ULTRASONIC QC SIMULATOR (AUTO-SYNC CALIBRATION)
==============================================================================
Fitur Utama:
- Auto-Sync Dua Arah dengan Web Dashboard: Mengikuti batas mutu (min/max OK) 
  yang diatur via slider web secara realtime.
- Membaca jarak virtual sensor ultrasonik HC-SR04 (cm).
- Evaluasi cerdas status mutu (PASS / DEFECT) sesuai standar aktif.
- Menampilkan visualisasi Serial Monitor dan status LED Onboard.
- Mengirimkan JSON payload via HTTP POST ke server lokal (port 3000).
==============================================================================
"""

import sys
import time
import json
import random
import threading
import urllib.request
import urllib.error

# --- KONFIGURASI TARGET SERVER ---
DEFAULT_SERVER_URL = "http://localhost:3000/api/inspection"
DEFAULT_CALIBRATION_URL = "http://localhost:3000/api/calibration"

# Parameter Batas Deteksi Fisik
DETECTION_THRESHOLD_CM = 20.0  # Objek dianggap melintas jika jarak <= 20 cm

# Warna Terminal ANSI
C_RESET   = "\033[0m"
C_BOLD    = "\033[1m"
C_RED     = "\033[91m"
C_GREEN   = "\033[92m"
C_YELLOW  = "\033[93m"
C_BLUE    = "\033[94m"
C_CYAN    = "\033[96m"
C_WHITE   = "\033[97m"
C_MAGENTA = "\033[95m"
C_DIM     = "\033[90m"

class VirtualESP32:
    def __init__(self, server_url=DEFAULT_SERVER_URL, cal_url=DEFAULT_CALIBRATION_URL):
        self.server_url = server_url
        self.cal_url = cal_url
        self.min_ok = 4.0
        self.max_ok = 7.0
        self.item_counter = 100
        self.pass_count = 0
        self.defect_count = 0
        self.auto_running = False
        self.auto_thread = None
        self.sync_active = True

        # Ambil kalibrasi aktif dari server secara instan
        self.fetch_calibration()

        # Jalankan background thread untuk auto-sync kalibrasi dari web
        self.sync_thread = threading.Thread(target=self._calibration_sync_worker, daemon=True)
        self.sync_thread.start()

    def fetch_calibration(self):
        """Mengambil kalibrasi ambang batas terbaru dari server/web dashboard"""
        try:
            req = urllib.request.Request(self.cal_url, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=1.5) as res:
                if res.status == 200:
                    data = json.loads(res.read().decode('utf-8'))
                    if "minOk" in data and "maxOk" in data:
                        new_min = float(data["minOk"])
                        new_max = float(data["maxOk"])
                        if new_min != self.min_ok or new_max != self.max_ok:
                            self.min_ok = new_min
                            self.max_ok = new_max
                            return True
        except Exception:
            pass
        return False

    def push_calibration(self, min_val, max_val):
        """Mengirim perubahan kalibrasi dari terminal ke server/web dashboard"""
        self.min_ok = min_val
        self.max_ok = max_val
        try:
            payload = json.dumps({"minOk": min_val, "maxOk": max_val}).encode('utf-8')
            req = urllib.request.Request(self.cal_url, data=payload, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=1.5) as res:
                return res.status == 200
        except Exception:
            return False

    def _calibration_sync_worker(self):
        """Worker background yang otomatis mengecek perubahan slider di web setiap 1 detik"""
        while self.sync_active:
            self.fetch_calibration()
            time.sleep(1.0)

    def evaluate_distance(self, distance_cm):
        """Mengevaluasi kualitas barang berdasarkan jarak pantulan dan standar kalibrasi aktif."""
        # Pastikan data kalibrasi terupdate
        self.fetch_calibration()

        if distance_cm > DETECTION_THRESHOLD_CM:
            return {
                "detected": False,
                "status": "STANDBY",
                "distance": distance_cm,
                "defectType": "Tidak Ada Objek",
                "action": "Standby Menunggu Barang"
            }

        self.item_counter += 1
        item_id = f"BRG-{self.item_counter}"
        ir_equiv = int(distance_cm * 25)

        if distance_cm < self.min_ok:
            status = "DEFECT"
            defect_type = f"Dimensi Terlalu Tebal / Tonjolan (< {self.min_ok:.1f} cm)"
            action = "Dorong ke Kotak Reject"
            self.defect_count += 1
        elif distance_cm > self.max_ok:
            status = "DEFECT"
            defect_type = f"Dimensi Penyok / Cekung (> {self.max_ok:.1f} cm)"
            action = "Dorong ke Kotak Reject"
            self.defect_count += 1
        else:
            status = "PASS"
            defect_type = f"Permukaan Sempurna (Normal {self.min_ok:.1f} - {self.max_ok:.1f} cm)"
            action = "Lolos ke Packaging"
            self.pass_count += 1

        payload = {
            "id": item_id,
            "status": status,
            "irVal": ir_equiv,
            "distance": round(distance_cm, 1),
            "defectType": defect_type,
            "action": action
        }
        return {"detected": True, "payload": payload}

    def send_http(self, payload):
        """Mengirim JSON payload ke backend server."""
        json_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            self.server_url,
            data=json_data,
            headers={'Content-Type': 'application/json'}
        )
        try:
            with urllib.request.urlopen(req, timeout=2) as response:
                return response.status
        except urllib.error.URLError as e:
            return f"ERR: {e.reason}"
        except Exception as e:
            return f"ERR: {str(e)}"

    def render_distance_gauge(self, dist_cm):
        """Visual gauge jarak sensor HC-SR04 dengan indikator zona aktif"""
        max_bars = 25
        clamped = min(max(dist_cm, 0.0), 25.0)
        filled = int((clamped / 25.0) * max_bars)
        
        # Penentuan warna bar berdasarkan zona kalibrasi aktif
        if dist_cm > DETECTION_THRESHOLD_CM:
            bar_color = C_DIM
            label = "STANDBY (>20cm)"
        elif self.min_ok <= dist_cm <= self.max_ok:
            bar_color = C_GREEN
            label = f"NORMAL / PASS ({self.min_ok:.1f} - {self.max_ok:.1f} cm)"
        else:
            bar_color = C_RED
            label = f"CACAT / DEFECT (Di luar {self.min_ok:.1f} - {self.max_ok:.1f} cm)"

        bar_str = bar_color + ("█" * filled) + (C_DIM + "░" * (max_bars - filled)) + C_RESET
        return f"[{bar_str}] {dist_cm:5.1f} cm  ({label})"

    def process_measurement(self, distance_cm):
        """Proses satu siklus pembacaan jarak sensor."""
        result = self.evaluate_distance(distance_cm)
        
        print("\n" + C_DIM + "─" * 68 + C_RESET)
        print(f"{C_CYAN}[HC-SR04 SENSOR]{C_RESET} {self.render_distance_gauge(distance_cm)}")
        print(f"{C_MAGENTA}⚡ [STANDAR AKTIF]{C_RESET} {C_BOLD}Zona PASS (Lolos): {self.min_ok:.1f} cm ≤ Jarak ≤ {self.max_ok:.1f} cm{C_RESET}")

        if not result["detected"]:
            print(f"{C_DIM}[ESP32 STATE] Standby - Menunggu objek di depan konveyor...{C_RESET}")
            return

        payload = result["payload"]
        status = payload["status"]
        
        if status == "PASS":
            status_badge = f"{C_BOLD}{C_GREEN}✔ PASS (Lolos OK){C_RESET}"
            led_info = f"{C_GREEN}[LED GPIO 2] Nyala Hijau/Biru 1x (Indikator Lolos){C_RESET}"
        else:
            status_badge = f"{C_BOLD}{C_RED}✖ DEFECT (Cacat!){C_RESET}"
            led_info = f"{C_RED}[LED GPIO 2] Berkedip Cepat 3x (Alarm Cacat!){C_RESET}"

        print(f"{C_WHITE}📦 ID Produk    :{C_RESET} {C_BOLD}{payload['id']}{C_RESET}")
        print(f"📊 Status QC    : {status_badge}")
        print(f"📏 Jarak Pantul : {payload['distance']} cm")
        print(f"🔍 Evaluasi Mutu: {payload['defectType']}")
        print(f"⚙️ Tindakan     : {payload['action']}")
        print(f"💡 Respon Board : {led_info}")

        # Kirim ke server HTTP
        print(f"{C_BLUE}📡 [HTTP POST] Mengirim ke {self.server_url}...{C_RESET}", end="", flush=True)
        res = self.send_http(payload)
        if res == 200:
            print(f" {C_GREEN}✔ HTTP 200 OK (Dashboard Web Terupdate!){C_RESET}")
        else:
            print(f" {C_YELLOW}⚠ {res} (Pastikan server.py aktif di port 3000){C_RESET}")

        print(f"{C_DIM}📈 Total: {self.pass_count + self.defect_count} | Lolos: {self.pass_count} | Cacat: {self.defect_count}{C_RESET}")

    def auto_conveyor_worker(self, interval_sec=2.0, defect_rate=0.3):
        """Worker thread untuk aliran otomatis konveyor pabrik"""
        print(f"\n{C_GREEN}🚀 [AUTO-CONVEYOR AKTIF]{C_RESET} Interval: {interval_sec}s | Defect Rate: {int(defect_rate*100)}%")
        print(f"{C_YELLOW}Tekan ENTER untuk menghentikan auto mode...{C_RESET}\n")

        while self.auto_running:
            self.fetch_calibration()
            is_defect = random.random() < defect_rate
            if is_defect:
                if random.choice([True, False]) and self.min_ok > 0.8:
                    dist = round(random.uniform(0.5, max(0.6, self.min_ok - 0.3)), 1)
                else:
                    dist = round(random.uniform(self.max_ok + 0.5, 18.0), 1)
            else:
                dist = round(random.uniform(self.min_ok + 0.1, max(self.min_ok + 0.2, self.max_ok - 0.1)), 1)

            self.process_measurement(dist)
            time.sleep(interval_sec)

def print_header(esp32):
    esp32.fetch_calibration()
    print(C_CYAN + "=" * 68 + C_RESET)
    print(f"{C_BOLD}{C_WHITE}   🤖 VIRTUAL ESP32 - HC-SR04 ULTRASONIC QC SIMULATOR{C_RESET}")
    print(f"{C_MAGENTA}   🔄 AUTO-SYNC WEB: Zona PASS Aktif = {esp32.min_ok:.1f} cm - {esp32.max_ok:.1f} cm{C_RESET}")
    print(C_CYAN + "=" * 68 + C_RESET)
    print(f"{C_YELLOW}PILIHAN PERINTAH:{C_RESET}")
    print(f"  {C_BOLD}[angka]{C_RESET}     : Set jarak manual dalam cm (contoh: {C_CYAN}2.0{C_RESET}, {C_CYAN}5.5{C_RESET}, {C_CYAN}12.0{C_RESET})")
    print(f"  {C_BOLD}r / refresh{C_RESET} : {C_GREEN}Refresh / Sync ulang batas mutu dari Web secara instan{C_RESET}")
    print(f"  {C_BOLD}p{C_RESET}           : Kirim Sampel {C_GREEN}PASS (Lolos sesuai zona aktif){C_RESET}")
    print(f"  {C_BOLD}d{C_RESET}           : Kirim Sampel {C_RED}DEFECT (Cacat di luar zona aktif){C_RESET}")
    print(f"  {C_BOLD}cal min max{C_RESET} : Ubah kalibrasi dari terminal (contoh: {C_CYAN}cal 1.0 3.0{C_RESET})")
    print(f"  {C_BOLD}s{C_RESET}           : Standby (Tidak ada barang / >20 cm)")
    print(f"  {C_BOLD}auto{C_RESET}        : Jalankan Aliran Konveyor Otomatis")
    print(f"  {C_BOLD}q{C_RESET}           : Keluar Simulator")
    print(C_CYAN + "─" * 68 + C_RESET)

def main():
    server_url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SERVER_URL
    esp32 = VirtualESP32(server_url=server_url)

    print_header(esp32)

    while True:
        try:
            esp32.fetch_calibration()
            prompt_str = f"\n{C_BOLD}{C_WHITE}Virtual-ESP32 {C_DIM}(Pass: {esp32.min_ok:.1f}-{esp32.max_ok:.1f}cm){C_CYAN}> {C_RESET}"
            cmd = input(prompt_str).strip().lower()
            if not cmd:
                continue

            if cmd in ['q', 'exit', 'quit']:
                esp32.sync_active = False
                print(f"\n{C_YELLOW}Virtual ESP32 dimatikan. Sampai jumpa!{C_RESET}")
                break

            elif cmd in ['r', 'refresh', 'sync']:
                esp32.fetch_calibration()
                print(f"\n{C_CYAN}🔄 [REFRESH SYNC]{C_RESET} Mengambil kalibrasi Web...")
                print(f"{C_GREEN}✔ Berhasil! Zona PASS Aktif saat ini: {C_BOLD}{esp32.min_ok:.1f} cm ≤ Jarak ≤ {esp32.max_ok:.1f} cm{C_RESET}")

            elif cmd.startswith('cal '):
                # Ubah kalibrasi manual dari terminal: misal "cal 1.0 3.0"
                parts = cmd.split()
                if len(parts) == 3:
                    try:
                        n_min = float(parts[1])
                        n_max = float(parts[2])
                        if n_min < n_max:
                            esp32.push_calibration(n_min, n_max)
                            print(f"{C_GREEN}✔ Kalibrasi diperbarui & disinkronkan ke Web: {n_min:.1f} cm - {n_max:.1f} cm{C_RESET}")
                        else:
                            print(f"{C_RED}⚠ Nilai min harus lebih kecil dari max.{C_RESET}")
                    except ValueError:
                        print(f"{C_RED}⚠ Format salah. Contoh: cal 1.0 3.0{C_RESET}")
                else:
                    print(f"{C_RED}⚠ Format salah. Gunakan: cal <min> <max>{C_RESET}")

            elif cmd == 'p':
                # Normal Pass sesuai kalibrasi aktif
                dist = round(random.uniform(esp32.min_ok + 0.2, max(esp32.min_ok + 0.3, esp32.max_ok - 0.2)), 1)
                esp32.process_measurement(dist)

            elif cmd == 'd':
                # Defect di luar kalibrasi aktif
                if random.choice([True, False]) and esp32.min_ok > 0.8:
                    dist = round(random.uniform(0.5, max(0.6, esp32.min_ok - 0.3)), 1)
                else:
                    dist = round(random.uniform(esp32.max_ok + 1.0, 16.0), 1)
                esp32.process_measurement(dist)

            elif cmd == 's':
                esp32.process_measurement(35.0)

            elif cmd == 'auto':
                esp32.auto_running = True
                esp32.auto_thread = threading.Thread(target=esp32.auto_conveyor_worker, args=(2.0, 0.3), daemon=True)
                esp32.auto_thread.start()
                try:
                    input()
                except (KeyboardInterrupt, EOFError):
                    pass
                esp32.auto_running = False
                time.sleep(0.5)
                print(f"{C_YELLOW}🛑 Mode Auto-Conveyor Dihentikan.{C_RESET}")

            else:
                try:
                    dist = float(cmd)
                    if dist < 0 or dist > 400:
                        print(f"{C_RED}⚠ Jarak HC-SR04 di luar jangkauan fisik (0 - 400 cm).{C_RESET}")
                    else:
                        esp32.process_measurement(dist)
                except ValueError:
                    print(f"{C_RED}⚠ Perintah tidak dikenal. Masukkan angka jarak (cm), 'p', 'd', 'cal min max', 'auto', atau 'q'.{C_RESET}")

        except (KeyboardInterrupt, EOFError):
            esp32.sync_active = False
            print(f"\n{C_YELLOW}Virtual ESP32 dimatikan.{C_RESET}")
            break

if __name__ == "__main__":
    main()
