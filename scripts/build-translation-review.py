#!/usr/bin/env python3
"""Build a self-contained local review from review-matrix.json."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', required=True)
parser.add_argument('--matrix', help='Optional source matrix; existing output snapshot is reused by default.')
args = parser.parse_args()
root = Path(args.directory).resolve()
root.mkdir(parents=True, exist_ok=True)
snapshot = root / 'review-matrix.json'
source = Path(args.matrix) if args.matrix else snapshot if snapshot.exists() else Path(__file__).with_name('translation-review-matrix.json')
matrix = json.loads(source.read_text())
if (root / 'human-review.json').exists():
    previous = json.loads(snapshot.read_text())
    if previous != matrix:
        raise ValueError('Existing human feedback pins this matrix. Use a fresh directory for a new round.')
if len({case['caseId'] for case in matrix.get('cases', [])}) != len(matrix.get('cases', [])):
    raise ValueError('Review case identities must be unique.')
if not matrix.get('matrixId') or not matrix.get('cases'):
    raise ValueError('Review matrix needs an identity and cases.')
snapshot.write_text(json.dumps(matrix, ensure_ascii=False, indent=2) + '\n')
encoded = json.dumps(matrix, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
template = Path(__file__).with_name('translation-review.html').read_text()
(root / 'human-review.html').write_text(template.replace('__MATRIX_JSON__', encoded))
print(f'Review built: {root / "human-review.html"}')
