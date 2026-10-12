"""Loopback-only experimental lab. No cloud upload or production deployment."""
from http.server import BaseHTTPRequestHandler,HTTPServer
import base64,io,json
from pathlib import Path
from PIL import Image
from reconstruct import reconstruct
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ('/','/lab.html'):self.send_error(404);return
        self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(Path(__file__).with_name('lab.html').read_bytes())
    def do_POST(self):
        try:
            if self.path!='/convert':self.send_error(404);return
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<15_000_000:raise ValueError('Request too large')
            x=json.loads(self.rfile.read(size));im=Image.open(io.BytesIO(base64.b64decode(x['image'],validate=True)))
            if im.width*im.height>4_000_000:raise ValueError('Limit: 4 million pixels')
            palette=x['palette'].split(',');tol=float(x.get('tolerance',1))
            if not .25<=tol<=3:raise ValueError('Tolerance must be .25–3px')
            svg,stats=reconstruct(im,palette,tol)
            data=json.dumps({'svg':svg,'stats':stats}).encode();self.send_response(200)
        except Exception as e:
            data=json.dumps({'error':str(e)}).encode();self.send_response(400)
        self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
if __name__=='__main__':print('Lab: http://127.0.0.1:8765');HTTPServer(('127.0.0.1',8765),Handler).serve_forever()
