import json
import sys
import shutil
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app_guard


TEMP_ROOT = Path(__file__).resolve().parent / "cache"


def cache_root(name):
    root = TEMP_ROOT / name
    shutil.rmtree(root / "tool", ignore_errors=True)
    (root / "tool").mkdir(parents=True, exist_ok=True)
    return root


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self, _size):
        return json.dumps(self.body).encode("utf-8")


class AppGuardTests(unittest.TestCase):
    def test_startup_check_posts_minimal_payload(self):
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured["timeout"] = timeout
            captured["body"] = json.loads(request.data.decode("utf-8"))
            return FakeResponse({
                "status": "warn",
                "message": "update",
                "message_level": "warning",
                "disable": False,
                "next_check_after_seconds": 60,
            })

        tmp = cache_root("minimal")
        with mock.patch.object(app_guard.urllib.request, "urlopen", fake_urlopen):
            result = app_guard.startup_check(
                app_id="tool",
                version="1.0.0",
                endpoint="https://example.test",
                cache_dir=tmp,
                timeout_seconds=0.8,
                prompt_handler=lambda _r: None,
            )

        self.assertEqual(result.status, "warn")
        self.assertEqual(captured["timeout"], 0.8)
        self.assertIn("install_id", captured["body"])
        self.assertIn("platform", captured["body"])
        self.assertNotIn("email", captured["body"])

    def test_fail_open_on_network_error(self):
        def fake_urlopen(_request, timeout=None):
            raise urllib.error.URLError("down")

        tmp = cache_root("fail_open")
        with mock.patch.object(app_guard.urllib.request, "urlopen", fake_urlopen):
            result = app_guard.startup_check(
                app_id="tool",
                version="1.0.0",
                endpoint="https://example.test",
                cache_dir=tmp,
                prompt_handler=lambda _r: None,
            )

        self.assertEqual(result.status, "allow")
        self.assertEqual(result.source, "fail-open")

    def test_disabled_cache_is_reused(self):
        calls = {"count": 0}

        def fake_urlopen(_request, timeout=None):
            calls["count"] += 1
            return FakeResponse({
                "status": "disabled",
                "message": "stop",
                "message_level": "error",
                "disable": True,
                "next_check_after_seconds": 3600,
            })

        tmp = cache_root("disabled")
        with mock.patch.object(app_guard.urllib.request, "urlopen", fake_urlopen):
            first = app_guard.startup_check(
                app_id="tool",
                version="1.0.0",
                endpoint="https://example.test",
                cache_dir=tmp,
                prompt_handler=lambda _r: None,
            )
            second = app_guard.startup_check(
                app_id="tool",
                version="1.0.0",
                endpoint="https://example.test",
                cache_dir=tmp,
                prompt_handler=lambda _r: None,
            )

        self.assertTrue(first.disabled)
        self.assertTrue(second.disabled)
        self.assertEqual(second.source, "cache-disabled")
        self.assertEqual(calls["count"], 1)


if __name__ == "__main__":
    unittest.main()
