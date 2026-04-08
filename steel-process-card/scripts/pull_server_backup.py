import json
import os
import stat
import sys
import time
from pathlib import Path

import paramiko


def load_config(config_path: Path):
  with config_path.open('r', encoding='utf-8') as handle:
    return json.load(handle)


def cleanup_old_backups(local_dir: Path, retention_days: int):
  cutoff = time.time() - retention_days * 24 * 60 * 60
  for file_path in local_dir.glob('process_card_*.dump'):
    if file_path.stat().st_mtime < cutoff:
      file_path.unlink(missing_ok=True)


def main():
  if len(sys.argv) != 2:
    print('Usage: python pull_server_backup.py <config.local.json>')
    raise SystemExit(1)

  config_path = Path(sys.argv[1]).expanduser().resolve()
  config = load_config(config_path)

  host = config['host']
  username = config['username']
  password = config['password']
  remote_dir = config['remote_dir']
  local_dir = Path(config['local_dir']).expanduser().resolve()
  retention_days = int(config.get('retention_days', 30))

  local_dir.mkdir(parents=True, exist_ok=True)

  client = paramiko.SSHClient()
  client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
  client.connect(host, username=username, password=password, timeout=20)

  sftp = client.open_sftp()
  try:
    entries = []
    for item in sftp.listdir_attr(remote_dir):
      if not stat.S_ISREG(item.st_mode):
        continue
      if not item.filename.startswith('process_card_') or not item.filename.endswith('.dump'):
        continue
      entries.append(item)

    if not entries:
      print('No remote backup files found.')
      return

    latest = max(entries, key=lambda item: item.st_mtime)
    remote_path = f"{remote_dir}/{latest.filename}"
    local_path = local_dir / latest.filename

    if local_path.exists() and int(local_path.stat().st_size) == int(latest.st_size):
      print(f'Latest backup already exists locally: {local_path}')
    else:
      sftp.get(remote_path, str(local_path))
      os.utime(local_path, (latest.st_atime, latest.st_mtime))
      print(f'Downloaded backup: {local_path}')

    cleanup_old_backups(local_dir, retention_days)
    print(f'Local backups older than {retention_days} days have been cleaned.')
  finally:
    sftp.close()
    client.close()


if __name__ == '__main__':
  main()
