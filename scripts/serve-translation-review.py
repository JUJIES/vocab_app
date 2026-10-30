#!/usr/bin/env python3
"""Serve an isolated evaluation review and save human comments locally.

No product routes, accounts, provider calls, or dependencies. Bind loopback only.
Usage: python3 scripts/serve-translation-review.py --directory output/ben-is-back-evaluation
"""
import argparse
import json
import os
from pathlib import Path
import tempfile
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


def serve(directory, port=0):
    root = Path(directory).resolve()
    matrix = json.loads((root / 'review-matrix.json').read_text())
    ids = {row['caseId'] for row in matrix['cases']}
    file = root / 'human-review.json'
    lock = threading.Lock()
    def empty():
        return {'schemaVersion': 1, 'matrixId': matrix['matrixId'], 'contextNote': '', 'ratings': {}}
    def read():
        return json.loads(file.read_text()) if file.exists() else empty()
    def short(value, limit):
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError('Invalid text field')
        return value
    def choice(value, options):
        if value not in options:
            raise ValueError('Invalid rating')
        return value
    def rating(value):
        if not isinstance(value, dict):
            raise ValueError('Invalid rating object')
        concerns = value.get('concerns', [])
        allowed = {'too_revealing', 'unclear_next_step', 'unnecessary_correction', 'too_generic', 'other'}
        if not isinstance(concerns, list) or len(concerns) > len(allowed) or any(x not in allowed for x in concerns):
            raise ValueError('Invalid concerns')
        return {
            'difficulty': choice(value.get('difficulty', ''), {'', 'easy', 'medium', 'hard', 'unsure'}),
            'difficultyBeforeReveal': choice(value.get('difficultyBeforeReveal', ''), {'', 'easy', 'medium', 'hard', 'unsure'}),
            'context': choice(value.get('context', ''), {'', 'good', 'awkward', 'unsure'}),
            'feedback': choice(value.get('feedback', ''), {'', 'helpful', 'partly', 'unhelpful', 'unsure'}),
            'concerns': list(dict.fromkeys(concerns)),
            'comment': short(value.get('comment', ''), 4000),
            'revealedAt': short(value.get('revealedAt', ''), 40),
            'updatedAt': short(value.get('updatedAt', ''), 40),
        }

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)
        def allowed_host(self):
            return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        def send_json(self, status, data):
            content = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        def do_GET(self):
            if not self.allowed_host():
                return self.send_json(403, {'error': 'Invalid host'})
            if urlsplit(self.path).path == '/api/review':
                with lock:
                    return self.send_json(200, read())
            return super().do_GET()
        def do_POST(self):
            origin = self.headers.get('Origin')
            if not self.allowed_host() or origin != 'http://' + self.headers.get('Host', ''):
                return self.send_json(403, {'error': 'Same-origin review only'})
            if self.path != '/api/review' or self.headers.get('Content-Type') != 'application/json':
                return self.send_json(400, {'error': 'Invalid review request'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 1 or length > 131072:
                    raise ValueError('Invalid size')
                data = json.loads(self.rfile.read(length))
                if data.get('matrixId') != matrix['matrixId']:
                    raise ValueError('Wrong review matrix')
                patches = data.get('ratings', {})
                if not isinstance(patches, dict) or any(key not in ids for key in patches):
                    raise ValueError('Unknown case')
                cleaned = {key: rating(value) for key, value in patches.items()}
                context = short(data['contextNote'], 2000) if 'contextNote' in data else None
                with lock:
                    state = read()
                    for key, value in cleaned.items():
                        previous = state['ratings'].get(key, {})
                        if previous.get('revealedAt'):
                            value['revealedAt'] = previous['revealedAt']
                            value['difficultyBeforeReveal'] = previous['difficultyBeforeReveal']
                        state['ratings'][key] = value
                    if context is not None:
                        state['contextNote'] = context
                    state['savedAt'] = datetime.now(timezone.utc).isoformat()
                    fd, temp = tempfile.mkstemp(prefix='.human-review-', dir=root)
                    try:
                        with os.fdopen(fd, 'w') as out:
                            json.dump(state, out, ensure_ascii=False, indent=2)
                        os.replace(temp, file)
                    finally:
                        if os.path.exists(temp):
                            os.unlink(temp)
                return self.send_json(200, {'savedAt': state['savedAt']})
            except (ValueError, TypeError, AttributeError, json.JSONDecodeError):
                return self.send_json(400, {'error': 'Invalid review data'})
            except OSError:
                return self.send_json(500, {'error': 'Could not save review file'})
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Review URL: http://127.0.0.1:{server.server_port}/human-review.html', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    serve(args.directory, args.port)
