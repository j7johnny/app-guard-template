from __future__ import annotations

import argparse
import datetime as dt
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app-id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--batch-id", default="")
    parser.add_argument("--channel", default="release")
    parser.add_argument("--output", default="build_info.py")
    args = parser.parse_args()

    commit = run_git(["rev-parse", "--short=12", "HEAD"]) or "local"
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")
    build_id = f"{stamp}-{commit}"
    content = f'''APP_ID = "{args.app_id}"
VERSION = "{args.version}"
BUILD_ID = "{build_id}"
BATCH_ID = "{args.batch_id}"
CHANNEL = "{args.channel}"
BUILT_AT = "{dt.datetime.now(dt.UTC).isoformat()}"
GIT_COMMIT = "{commit}"
ENDPOINT = "{args.endpoint}"
'''
    Path(args.output).write_text(content, encoding="utf-8")
    print(f"wrote {args.output}: {build_id}")


def run_git(args: list[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


if __name__ == "__main__":
    main()
