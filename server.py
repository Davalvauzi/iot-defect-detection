"""
Backend Server IoT QC Sederhana & Stabil (Polling Base)
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Menyimpan data inspeksi terakhir & konfigurasi kalibrasi mutu
latest_data = None
current_calibration = {"minOk": 4.0, "maxOk": 7.0}

class IoTRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        global latest_data, current_calibration
        # Endpoint untuk browser mengambil data terbaru
        if self.path == '/api/latest':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = latest_data if latest_data else {}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            return

        # Endpoint untuk sinkronisasi kalibrasi dari web ke Virtual ESP32
        if self.path == '/api/calibration':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(current_calibration).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        global latest_data, current_calibration
        if self.path == '/api/calibration':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                if "minOk" in data and "maxOk" in data:
                    current_calibration["minOk"] = float(data["minOk"])
                    current_calibration["maxOk"] = float(data["maxOk"])
                    print(f"\n[CALIBRATION SYNC] Batas Mutu Diperbarui: {current_calibration['minOk']} cm - {current_calibration['maxOk']} cm")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "calibration": current_calibration}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f'{{"status":"error","message":"{str(e)}"}}'.encode('utf-8'))
            return

        if self.path == '/api/reset':
            latest_data = {}
            print("\n[RESET] Server memory & latest data cleared!")
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Cleared"}).encode('utf-8'))
            return

        if self.path == '/api/inspection':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            try:
                latest_data = json.loads(post_data.decode('utf-8'))
                print("\n[ESP32 DATA RECEIVED]")
                print(json.dumps(latest_data, indent=2))

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = {"status": "success"}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f'{{"status":"error","message":"{str(e)}"}}'.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, IoTRequestHandler)
    print("=" * 55)
    print(f" Server Aktif & Stabil di: http://localhost:{PORT}")
    print("=" * 55)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")

if __name__ == '__main__':
    run()