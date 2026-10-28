import http.server
import socketserver
import os
import urllib.parse

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        clean_path = parsed.path

        if clean_path != '/':
            local_path = os.path.join(DIRECTORY, clean_path.lstrip('/'))
            # If path without .html doesn't exist, but with .html it does, rewrite path
            if not os.path.exists(local_path) and os.path.exists(local_path + '.html'):
                self.path = clean_path + '.html'
                if parsed.query:
                    self.path += '?' + parsed.query

        return super().do_GET()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with ThreadedTCPServer(("", PORT), CleanURLHandler) as httpd:
        print(f"Server running at http://localhost:{PORT} (clean URLs + multithreading enabled)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
