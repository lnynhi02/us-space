import http.server
import json
import pathlib
import socketserver

ROOT = pathlib.Path(__file__).resolve().parent


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


ENV = read_env(ROOT / ".env")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/assets/js/script.js":
            source = (ROOT / "assets/js/script.js").read_text(encoding="utf-8")
            injected = {
                "VITE_SUPABASE_URL": ENV.get("VITE_SUPABASE_URL", ""),
                "VITE_SUPABASE_ANON_KEY": ENV.get("VITE_SUPABASE_ANON_KEY", ""),
                "VITE_SITE_PASSWORD_HASH": ENV.get("VITE_SITE_PASSWORD_HASH", ""),
            }
            source = source.replace("import.meta.env", json.dumps(injected, ensure_ascii=False))
            body = source.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(ENV.get("PORT", "8000"))
    with Server(("127.0.0.1", port), Handler) as httpd:
        print("Serving at http://127.0.0.1:" + str(port))
        httpd.serve_forever()
