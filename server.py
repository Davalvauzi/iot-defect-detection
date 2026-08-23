"""
Backend Server Sederhana untuk Web Dashboard & ESP32
Menyediakan server statis untuk index.html serta REST API untuk menerima data dari ESP32.
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class IoTRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        # Endpoint untuk menerima data inspeksi dari ESP32
        if self.path == '/api/inspection':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                print("\n[ESP32 DATA RECEIVED]")
                print(json.dumps(data, indent=2))

                # Kirim response 200 OK
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = {"status": "success", "message": "Data berhasil diterima"}
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(f'{{"status":"error","message":"{str(e)}"}}'.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        # Handle CORS preflight request
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, IoTRequestHandler)
    print("=" * 55)
    print(f" IoT QC Dashboard Server Berjalan di: http://localhost:{PORT}")
    print(f" Buka link di browser: http://localhost:{PORT}/index.html")
    print("=" * 55)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")

if __name__ == '__main__':
    run()
