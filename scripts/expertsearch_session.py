#!/usr/bin/env python3
"""Start/stop a four-hour Mac-only price API and account-free Cloudflare Quick Tunnel."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / '.local/expertsearch-session'
STATE = STATE_DIR / 'state.json'


def read_state():
    try:
        return json.loads(STATE.read_text())
    except (FileNotFoundError, ValueError):
        return {}


def alive(pid):
    if not isinstance(pid, int):
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def write_state(value):
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    temp.replace(STATE)


def supervise(hours):
    children = []
    start = time.time()
    expires = dt.datetime.fromtimestamp(start + hours * 3600, dt.timezone.utc).isoformat()
    state = {'pid': os.getpid(), 'status': 'starting', 'expires_at': expires}
    write_state(state)

    def stop(signum=None, frame=None):
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        state['status'] = 'stopped'
        write_state(state)
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        env = os.environ.copy()
        env['EXPERTSEARCH_EXPIRES_AT'] = expires
        with (STATE_DIR/'api.log').open('w') as api_log, (STATE_DIR/'tunnel.log').open('w') as tunnel_log:
            children.append(subprocess.Popen([shutil.which('node'), str(ROOT/'expertsearch-service/mac-server.mjs')], cwd=ROOT,
                                             env=env, stdin=subprocess.DEVNULL, stdout=api_log, stderr=subprocess.STDOUT))
            # Confirm loopback service before publishing any tunnel.
            for _ in range(40):
                if children[0].poll() is not None:
                    raise RuntimeError('API failed to start; see api.log')
                try:
                    req = urllib.request.Request('http://127.0.0.1:8776/status', headers={'Origin':'https://g-schenk.de'})
                    with urllib.request.urlopen(req, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(.2)
            else:
                raise RuntimeError('Loopback API did not become ready')
            children.append(subprocess.Popen([shutil.which('cloudflared'), 'tunnel', '--no-autoupdate', '--protocol', 'http2',
                                             '--url', 'http://127.0.0.1:8776'], cwd=STATE_DIR,
                                             stdin=subprocess.DEVNULL, stdout=tunnel_log, stderr=subprocess.STDOUT))
            children.append(subprocess.Popen(['/usr/bin/caffeinate', '-i', '-t', str(int(hours*3600))],
                                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            state['children'] = [child.pid for child in children]
            write_state(state)
            for _ in range(150):
                if children[1].poll() is not None:
                    raise RuntimeError('Tunnel exited; see tunnel.log')
                match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', (STATE_DIR/'tunnel.log').read_text())
                if match:
                    state['api_base'] = match.group()
                    state['status'] = 'running'
                    write_state(state)
                    break
                time.sleep(.4)
            else:
                raise RuntimeError('No Quick Tunnel URL was returned')
            while time.time() < start + hours*3600:
                if any(child.poll() is not None for child in children[:2]):
                    state['error'] = 'API or tunnel stopped'
                    break
                time.sleep(1)
    except Exception as exc:
        state['error'] = str(exc)
    finally:
        stop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop', 'status', '_run'])
    parser.add_argument('--hours', type=float, default=4)
    args = parser.parse_args()
    if not .01 <= args.hours <= 12:
        parser.error('Duration must be between .01 and 12 hours')
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if args.action == '_run':
        supervise(args.hours)
        return
    state = read_state()
    if args.action == 'status':
        print(json.dumps({**state, 'process_alive':alive(state.get('pid'))}))
        return
    if args.action == 'stop':
        if alive(state.get('pid')):
            os.kill(state['pid'], signal.SIGTERM)
            for _ in range(50):
                if read_state().get('status') == 'stopped':
                    break
                time.sleep(.1)
        print(json.dumps(read_state()))
        return
    if state.get('status') in ('running','starting') and alive(state.get('pid')):
        print(json.dumps(state))
        return
    if not shutil.which('cloudflared') or not shutil.which('node'):
        parser.error('cloudflared and Node must already be installed')
    with (STATE_DIR/'supervisor.log').open('a') as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '_run', '--hours', str(args.hours)], cwd=ROOT,
                                   stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    for _ in range(180):
        value = read_state()
        if value.get('pid') == process.pid and value.get('status') == 'running':
            print(json.dumps(value))
            return
        if process.poll() is not None:
            parser.error('Session did not start: ' + str(read_state().get('error','see .local/expertsearch-session')))
        time.sleep(.4)
    parser.error('Session startup timed out; check status before starting another')


if __name__ == '__main__':
    main()
