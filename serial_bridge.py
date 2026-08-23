import serial
import serial.tools.list_ports
import json
import time
import urllib.request

def find_esp_port():
    ports = serial.tools.list_ports.comports()
    for port, desc, hwid in ports:
        print(f"Ditemukan Port: {port} - {desc}")
        if "CP210" in desc or "CH340" in desc or "USB" in desc or "Serial" in desc:
            return port
    if ports:
        return ports[0].device
    return "COM8"

def main():
    target_port = find_esp_port()
    baud_rate = 115200
    backend_url = "http://localhost:3000/api/inspection"

    print("=======================================================")
    print("   BRIDGE SERIAL USB ESP32 -> WEB DASHBOARD IOT QC   ")
    print("=======================================================")
    print(f"Membuka Serial Port: {target_port} pada {baud_rate} baud...")

    try:
        ser = serial.Serial(target_port, baud_rate, timeout=1)
        time.sleep(2)
        print(f"✓ Berhasil terhubung ke {target_port}!")
        print("Menunggu data deteksi dari ESP32 (lewatkan barang di depan HC-SR04)...")
        print("Tekan Ctrl+C untuk berhenti.\n")

        while True:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                if line.startswith('{') and line.endswith('}'):
                    try:
                        data = json.loads(line)
                        print(f"📦 [ESP32 DATA]: ID={data.get('id')} | Status={data.get('status')} | Jarak={data.get('distance')}cm | {data.get('defectType')}")

                        # Forward to Web Dashboard
                        req = urllib.request.Request(
                            backend_url,
                            data=line.encode('utf-8'),
                            headers={'Content-Type': 'application/json'}
                        )
                        try:
                            with urllib.request.urlopen(req, timeout=2) as resp:
                                print(f"   ↳ Terkirim ke Web Dashboard: HTTP {resp.getcode()}")
                        except Exception as e:
                            print(f"   ↳ Gagal kirim ke backend (pastikan server.py aktif): {e}")

                    except json.JSONDecodeError:
                        print(f"[SERIAL]: {line}")
                else:
                    print(f"[SERIAL INFO]: {line}")

    except Exception as err:
        print(f"\n❌ Gagal membuka serial port {target_port}: {err}")
        print("Tips: Pastikan kabel USB terpasang dan port tidak sedang dibuka di Arduino IDE Serial Monitor.")

if __name__ == "__main__":
    main()
