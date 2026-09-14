#!/usr/bin/env python3
"""Regenerate lab.html from index.html.

The lab is the same app on the same origin, unhooked from everything that would
let an experiment leak into the real product:

  - its own localStorage namespace, so a lab session cannot touch real sprites
  - no analytics beacon, so lab traffic is not counted
  - noindex, so search engines never surface it
  - no Open Graph tags, so a pasted link does not render as the product

Run it after any prod change that the lab should inherit:

    python3 tools/make-lab.py

Lab-only edits then go on top, in lab.html, by hand.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'index.html')
DST = os.path.join(ROOT, 'lab.html')

s = io.open(SRC, encoding='utf-8').read()
checks = []


def sub_once(pattern, repl, label, flags=0):
    global s
    s, n = re.subn(pattern, repl, s, count=1, flags=flags)
    checks.append((label, n == 1))


sub_once(r'<title>[^<]*</title>', '<title>Blockmode — LAB</title>', 'title')
sub_once(r'(?=<meta name="viewport")',
         '<meta name="robots" content="noindex,nofollow">\n', 'noindex')
sub_once(r'<!-- Open Graph / social preview -->.*?<meta name="twitter:image"[^>]*>\n',
         '', 'strip og', re.S)
sub_once(r'<!-- Cloudflare Web Analytics.*?</script>\n', '', 'strip analytics', re.S)

for key in ('blockmode:v1', 'blockmode:onboarded', 'blockmode:theme', 'blockmode:hints'):
    ns = key.replace('blockmode:', 'blockmode:lab:')
    s, n = re.subn(re.escape("'" + key + "'"), "'" + ns + "'", s)
    checks.append(('namespace ' + key, n >= 1))

# Mirror of promote-lab's leftovers check. A prod key surviving here is a key this
# script was never told about, and the lab would then share that storage jar with the
# real product -- exactly what the namespace exists to prevent. Refuse to write.
leaked = sorted(set(re.findall(r"'(blockmode:(?!lab:)[A-Za-z0-9_:-]+)'", s)))
if leaked:
    sys.stderr.write('make-lab: prod storage keys survived: ' + ', '.join(leaked) + '\n')
    sys.stderr.write('  add them to the namespace loop above, then run again\n')
    sys.exit(1)

bad = [label for label, ok in checks if not ok]
if bad:
    sys.stderr.write('make-lab: transform did not apply: ' + ', '.join(bad) + '\n')
    sys.exit(1)

io.open(DST, 'w', encoding='utf-8').write(s)
print('lab.html regenerated from index.html (' + str(len(s.splitlines())) + ' lines)')
