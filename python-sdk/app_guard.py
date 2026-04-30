"""
Single-file Python SDK for App Guard startup checks.

Design goals:
- send only minimal whitelisted metadata;
- create a random local install_id, never a hardware fingerprint;
- fail open on network/server errors by default;
- cache recent disabled decisions for explicit remote stops;
- never download or execute remote code.
"""

from __future__ import annotations

import json
import os
import platform as platform_module
import secrets
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Optional

SDK_VERSION = "0.1.0"
DEFAULT_TIMEOUT_SECONDS = 1.2
DEFAULT_NEXT_CHECK_SECONDS = 86400
MAX_DISABLED_CACHE_SECONDS = 7 * 86400


@dataclass(frozen=True)
class GuardResult:
    status: str = "allow"
    message: str = ""
    message_level: str = "info"
    disable: bool = False
    min_version: str = ""
    next_check_after_seconds: int = DEFAULT_NEXT_CHECK_SECONDS
    support_url: str = ""
    source: str = "default"
    error: str = ""

    @property
    def warning(self) -> bool:
        return self.status == "warn" and bool(self.message)

    @property
    def disabled(self) -> bool:
        return self.disable or self.status == "disabled"


PromptHandler = Callable[[GuardResult], None]


def startup_check(
    *,
    app_id: str,
    version: str,
    endpoint: str,
    build_id: str = "",
    batch_id: str = "",
    channel: str = "release",
    runtime: Optional[str] = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    cache_dir: Optional[str | os.PathLike[str]] = None,
    prompt_handler: Optional[PromptHandler] = None,
    fail_open: bool = True,
    force_check: bool = False,
    telemetry_enabled: bool = True,
) -> GuardResult:
    """
    Run a startup guard check.

    Call this near the top of your CLI or GUI entrypoint. If the result is
    disabled, stop the app after displaying the message.
    """

    cache = _load_cache(app_id, cache_dir)
    now = int(time.time())

    cached_result = _cached_result_if_valid(cache, now)
    if cached_result and not force_check:
        _prompt_if_needed(cached_result, prompt_handler)
        return cached_result

    install_id = _get_or_create_install_id(cache)
    payload = _build_payload(
        app_id=app_id,
        version=version,
        build_id=build_id,
        batch_id=batch_id,
        channel=channel,
        runtime=runtime,
        install_id=install_id,
        telemetry_enabled=telemetry_enabled,
    )

    try:
        result = _post_check(endpoint, payload, timeout_seconds)
    except Exception as exc:
        fallback = GuardResult(status="allow", source="fail-open", error=str(exc))
        if not fail_open:
            fallback = GuardResult(
                status="disabled",
                disable=True,
                message="無法完成啟動檢查，請稍後再試。",
                message_level="error",
                source="fail-closed",
                error=str(exc),
            )
        _save_cache(app_id, cache, cache_dir, fallback, now)
        _prompt_if_needed(fallback, prompt_handler)
        return fallback

    _save_cache(app_id, cache, cache_dir, result, now)
    _prompt_if_needed(result, prompt_handler)
    return result


def default_cli_prompt(result: GuardResult) -> None:
    if not result.message:
        return
    stream = sys.stderr if result.message_level in {"warning", "error"} else sys.stdout
    print(result.message, file=stream)
    if result.support_url:
        print(result.support_url, file=stream)


def tk_messagebox_prompt(result: GuardResult) -> None:
    if not result.message:
        return
    try:
        import tkinter.messagebox as messagebox
    except Exception:
        default_cli_prompt(result)
        return

    title = "程式啟動檢查"
    if result.disabled:
        messagebox.showerror(title, result.message)
    elif result.message_level == "warning":
        messagebox.showwarning(title, result.message)
    else:
        messagebox.showinfo(title, result.message)


def exit_if_disabled(result: GuardResult, code: int = 1) -> None:
    if result.disabled:
        raise SystemExit(code)


def _build_payload(
    *,
    app_id: str,
    version: str,
    build_id: str,
    batch_id: str,
    channel: str,
    runtime: Optional[str],
    install_id: str,
    telemetry_enabled: bool,
) -> dict[str, str]:
    payload = {
        "app_id": app_id,
        "version": version,
        "build_id": build_id,
        "batch_id": batch_id,
        "channel": channel,
        "sdk_version": SDK_VERSION,
        "runtime": runtime or _default_runtime(),
        "platform": _platform_name(),
        "install_id": install_id,
        "event": "startup_check",
    }
    if not telemetry_enabled:
        payload["install_id"] = ""
    return {key: value for key, value in payload.items() if value != ""}


def _post_check(endpoint: str, payload: Mapping[str, str], timeout_seconds: float) -> GuardResult:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint.rstrip("/") + "/check",
        data=data,
        headers={"content-type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        raw = response.read(32 * 1024)
    body = json.loads(raw.decode("utf-8"))
    return GuardResult(
        status=str(body.get("status", "allow")),
        message=str(body.get("message", "")),
        message_level=str(body.get("message_level", "info")),
        disable=bool(body.get("disable", False)),
        min_version=str(body.get("min_version", "")),
        next_check_after_seconds=int(body.get("next_check_after_seconds", DEFAULT_NEXT_CHECK_SECONDS)),
        support_url=str(body.get("support_url", "")),
        source="remote",
    )


def _load_cache(app_id: str, cache_dir: Optional[str | os.PathLike[str]]) -> dict[str, Any]:
    path = _cache_path(app_id, cache_dir)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_cache(
    app_id: str,
    cache: dict[str, Any],
    cache_dir: Optional[str | os.PathLike[str]],
    result: GuardResult,
    now: int,
) -> None:
    cache["last_checked_at"] = now
    cache["next_check_at"] = now + max(60, int(result.next_check_after_seconds))
    if result.disabled:
        cache["disabled_until"] = now + min(
            MAX_DISABLED_CACHE_SECONDS,
            max(60, int(result.next_check_after_seconds)),
        )
    else:
        cache.pop("disabled_until", None)
    cache["last_result"] = {
        "status": result.status,
        "message": result.message,
        "message_level": result.message_level,
        "disable": result.disable,
        "min_version": result.min_version,
        "next_check_after_seconds": result.next_check_after_seconds,
        "support_url": result.support_url,
    }
    path = _cache_path(app_id, cache_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _cached_result_if_valid(cache: Mapping[str, Any], now: int) -> Optional[GuardResult]:
    last = cache.get("last_result")
    if not isinstance(last, dict):
        return None
    disabled_until = int(cache.get("disabled_until") or 0)
    if disabled_until and disabled_until > now:
        return _result_from_cache(last, source="cache-disabled")
    next_check_at = int(cache.get("next_check_at") or 0)
    if next_check_at > now:
        return _result_from_cache(last, source="cache")
    return None


def _result_from_cache(last: Mapping[str, Any], *, source: str) -> GuardResult:
    return GuardResult(
        status=str(last.get("status", "allow")),
        message=str(last.get("message", "")),
        message_level=str(last.get("message_level", "info")),
        disable=bool(last.get("disable", False)),
        min_version=str(last.get("min_version", "")),
        next_check_after_seconds=int(last.get("next_check_after_seconds", DEFAULT_NEXT_CHECK_SECONDS)),
        support_url=str(last.get("support_url", "")),
        source=source,
    )


def _get_or_create_install_id(cache: dict[str, Any]) -> str:
    existing = cache.get("install_id")
    if isinstance(existing, str) and len(existing) >= 16:
        return existing
    install_id = secrets.token_urlsafe(24)
    cache["install_id"] = install_id
    return install_id


def _cache_path(app_id: str, cache_dir: Optional[str | os.PathLike[str]]) -> Path:
    safe_app_id = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in app_id)
    if cache_dir is not None:
        root = Path(cache_dir)
    elif os.name == "nt":
        root = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "AppGuard"
    else:
        root = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")) / "app-guard"
    return root / safe_app_id / "guard-cache.json"


def _prompt_if_needed(result: GuardResult, prompt_handler: Optional[PromptHandler]) -> None:
    if not result.message:
        return
    (prompt_handler or default_cli_prompt)(result)


def _default_runtime() -> str:
    return "python-exe" if getattr(sys, "frozen", False) else "python"


def _platform_name() -> str:
    name = platform_module.system().lower()
    if name.startswith("darwin"):
        return "macos"
    return name or "unknown"
