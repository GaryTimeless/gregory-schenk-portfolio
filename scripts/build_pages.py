#!/usr/bin/env python3
"""Build public Pages output and omit customer pages/images after their review window."""
import argparse
import datetime as dt
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
STATIC = ('index.html', 'impressum.html', 'datenschutz.html', 'CNAME', '.nojekyll')

def deadline(value):
    result = dt.datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise ValueError('Deadline requires timezone')
    return result

def build(output, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    manifest = json.loads((ROOT/'preview-source/manifest.json').read_text())
    expires = deadline(manifest['expires_at'])
    starts = deadline(manifest['published_at'])
    if expires - starts != dt.timedelta(days=14):
        raise ValueError('Preview interval must be fourteen days')
    if manifest['path'] != 'kundenprojekt':
        raise ValueError('Unexpected project path')
    # Build in a temporary sibling; never replace the served output with a partial build.
    stage = output.with_name(output.name+'.building')
    if stage.exists(): shutil.rmtree(stage)
    stage.mkdir(parents=True)
    for name in STATIC: shutil.copy2(ROOT/name, stage/name)
    shutil.copytree(ROOT/'assets', stage/'assets')
    customer = stage/'kundenprojekt'
    customer.mkdir()
    active = starts <= now < expires
    if active:
        source = ROOT/'preview-source/pension-anita'
        allowed = {'.html','.css','.js','.jpg','.jpeg','.png','.gif','.webp','.svg','.woff','.woff2','.ico'}
        for file in source.rglob('*'):
            if file.is_symlink(): raise ValueError('Unexpected symbolic link in preview')
            if file.is_dir(): continue
            relative = file.relative_to(source)
            if any(part.startswith('.') for part in relative.parts) or file.suffix.lower() not in allowed:
                raise ValueError('Unexpected preview source content')
            target = customer/relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)
    else:
        (customer/'index.html').write_text('''<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Vorschau beendet · Gregory Schenk</title><style>body{margin:0;background:#f9e8df;color:#183f45;font:17px/1.7 system-ui,sans-serif}main{max-width:640px;margin:12vh auto;padding:28px}h1{font:normal 42px/1.15 Georgia,serif}a{color:inherit}</style><main><p>Gregory Schenk · Webdesign aus Karlsruhe</p><h1>Die Vorschau ist derzeit nicht verfügbar.</h1><p>Der vorgesehene Besprechungszeitraum ist beendet oder hat noch nicht begonnen. Für eine Freischaltung melden Sie sich gern bei mir.</p><p><a href="mailto:gregoryschenk@me.com">Kontakt per E-Mail</a></p><p><a href="/">Zum Portfolio</a> · <a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a></p></main></html>''')
    (stage/'robots.txt').write_text('User-agent: *\nDisallow: /kundenprojekt/assets/\nDisallow: /kundenprojekt/previews/\n')
    if output.exists(): shutil.rmtree(output)
    stage.rename(output)
    print(json.dumps({'preview_active':active,'expires_at':manifest['expires_at']}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'_site')
    args=parser.parse_args()
    build(args.output)
