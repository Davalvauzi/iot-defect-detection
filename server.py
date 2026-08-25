"""
Backend Server IoT QC Sederhana & Stabil (Polling Base)
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Menyimpan data inspeksi terakhir
latest_data = None

class IoTRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        global latest_data
        # Endpoint untuk browser mengambil data terbaru
        if self.path == '/api/latest':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = latest_data if latest_data else {}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            return

        super().do_GET()

    def do_POST(self):
        global latest_data
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