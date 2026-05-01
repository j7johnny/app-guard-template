# AI Agent 整合手冊：Codex / Claude Code

這份文件是給 Codex、Claude Code 或其他 VibeCoding 工具讀取的操作規格。目標是把 App Guard SDK 加入任一 Python 小工具，並讓打包流程能產生可追蹤的 `BUILD_ID` 與人工輸入的 `batch_id`。

## 最重要的規則

- 先讀專案，不要猜入口點。
- 只支援 Python/EXE 啟動前檢查；不要把它改成授權系統或硬體指紋系統。
- 每次程式啟動都要呼叫遠端 `/check`。
- 不要加入 allow/warn 快取來跳過啟動檢查。
- 只允許 disabled 快取在網路失敗時維持封鎖。
- 預設 fail-open：網路錯誤時放行，除非使用者明確要求 fail-closed。
- 不下載、不 eval、不執行任何遠端回傳程式碼。
- 不讀取或上傳敏感本機資訊。
- timeout 建議 0.8 到 1.5 秒。

## 禁止蒐集

不得蒐集、傳送或推導以下資料：

- 姓名、email、帳號。
- MAC、磁碟序號、Windows SID、硬體指紋。
- 使用者資料夾、完整檔案路徑、執行參數內容。
- 剪貼簿、鍵盤輸入、瀏覽器資料、最近開啟檔案。
- 完整 user agent。

允許欄位只有：

```json
{
  "app_id": "my_tool",
  "version": "1.2.0",
  "build_id": "20260501-120000-abcdef123456",
  "batch_id": "friend-group-a",
  "channel": "release",
  "sdk_version": "0.1.0",
  "runtime": "python-exe",
  "platform": "windows",
  "install_id": "local-random-id",
  "event": "startup_check"
}
```

`install_id` 必須由 SDK 隨機產生並存在 App 專屬快取，不得從硬體資訊推導。

## AI Agent 工作流程

1. 找出 Python 專案入口點。
   - 常見位置：`__main__.py`、`main.py`、`app.py`、GUI 啟動檔、PyInstaller `.spec` 指向的 script。
   - 如果有多個入口點，先列出並選擇實際打包/執行使用的入口。

2. 複製 SDK。
   - 從本 repo 的 `python-sdk/app_guard.py` 複製到目標專案。
   - 建議放在目標 package 內，例如 `src/my_tool/app_guard.py`。
   - 不要改 SDK 的資料欄位白名單，除非使用者明確要求。

3. 新增或改造 `build_info.py`。
   - 放在可被入口點 import 的位置。
   - 必要常數：

```python
APP_ID = "my_tool"
VERSION = "1.0.0"
BUILD_ID = "20260501-120000-abcdef123456"
BATCH_ID = "default"
CHANNEL = "release"
BUILT_AT = "2026-05-01T12:00:00+00:00"
GIT_COMMIT = "abcdef123456"
ENDPOINT = "https://your-worker.workers.dev"
```

4. 在入口點最前面加入檢查。
   - 位置要早於耗時初始化、主視窗建立、主要功能執行。
   - GUI 可以先做必要的 DPI 設定，但 App Guard 應早於主畫面。

5. 更新打包腳本。
   - 打包前先產生 `build_info.py`。
   - 以互動方式詢問 `batch_id`。
   - `BUILD_ID` 必須自動產生，不要要求使用者手打。

6. 驗證。
   - 單元測試或手動 mock：確認 payload 只含允許欄位。
   - 測試 remote `disabled` 時程式會停止。
   - 測試網路失敗時預設 fail-open。
   - 測試 allow/warn 不會讓下一次啟動跳過遠端 `/check`。

## CLI 程式插入範例

如果 `app_guard.py` 和 `build_info.py` 跟入口檔同層：

```python
from app_guard import default_cli_prompt, exit_if_disabled, startup_check
from build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION


def run_app_guard() -> None:
    result = startup_check(
        app_id=APP_ID,
        version=VERSION,
        build_id=BUILD_ID,
        batch_id=BATCH_ID,
        channel=CHANNEL,
        endpoint=ENDPOINT,
        timeout_seconds=1.2,
        prompt_handler=default_cli_prompt,
    )
    exit_if_disabled(result)
```

在入口點：

```python
def main() -> None:
    run_app_guard()
    # 原本主程式從這裡開始
```

## GUI 程式插入範例

```python
from app_guard import exit_if_disabled, startup_check, tk_messagebox_prompt
from build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION


def run_app_guard() -> bool:
    result = startup_check(
        app_id=APP_ID,
        version=VERSION,
        build_id=BUILD_ID,
        batch_id=BATCH_ID,
        channel=CHANNEL,
        endpoint=ENDPOINT,
        timeout_seconds=1.2,
        prompt_handler=tk_messagebox_prompt,
    )
    try:
        exit_if_disabled(result)
    except SystemExit:
        return False
    return True
```

在 GUI main：

```python
def main() -> None:
    if not run_app_guard():
        return
    # 建立主視窗
```

## Package 內 import 範例

若 SDK 放在 package 內：

```python
from my_tool.app_guard import exit_if_disabled, startup_check, tk_messagebox_prompt
from my_tool.build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION
```

請依目標專案既有 import 風格調整，不要硬改整個專案結構。

## build_info 產生腳本

可在目標專案新增 `scripts/make_build_info.py`：

```python
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
    parser.add_argument("--batch-id", default="default")
    parser.add_argument("--channel", default="release")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    commit = run_git(["rev-parse", "--short=12", "HEAD"]) or "local"
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")
    build_id = f"{stamp}-{commit}"
    built_at = dt.datetime.now(dt.UTC).isoformat()

    content = f'''APP_ID = "{args.app_id}"
VERSION = "{args.version}"
BUILD_ID = "{build_id}"
BATCH_ID = "{args.batch_id}"
CHANNEL = "{args.channel}"
BUILT_AT = "{built_at}"
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
```

## Windows build.bat 範本

這個範本會在打包時互動詢問 `batch_id`：

```bat
@echo off
setlocal

REM Prefer Python 3.11; fall back to python on PATH.
SET "PY=C:\Program Files\Python311\python.exe"
IF NOT EXIST "%PY%" SET "PY=python"

echo [1/3] Installing dependencies...
"%PY%" -m pip install pyinstaller
if %ERRORLEVEL% neq 0 exit /b 1

echo.
echo [2/3] Generating App Guard build metadata...
set /p APP_GUARD_BATCH_ID=Enter App Guard batch_id for this build [default]: 
if "%APP_GUARD_BATCH_ID%"=="" set "APP_GUARD_BATCH_ID=default"

"%PY%" scripts\make_build_info.py ^
  --app-id my_tool ^
  --version 1.0.0 ^
  --batch-id "%APP_GUARD_BATCH_ID%" ^
  --channel release ^
  --endpoint https://your-worker.workers.dev ^
  --output src\my_tool\build_info.py
if %ERRORLEVEL% neq 0 exit /b 1

echo.
echo [3/3] Building EXE...
"%PY%" -m PyInstaller MyTool.spec
if %ERRORLEVEL% neq 0 exit /b 1

echo Done.
pause
```

注意：

- `.bat` 建議維持 ASCII，避免 Windows code page 造成中文亂碼。
- 如果路徑或 echo 文字含括號，請注意 escaping。
- 若使用 `.spec`，確認 `build_info.py` 被包含進 bundle。

## PowerShell 打包範本

```powershell
$ErrorActionPreference = "Stop"

$batchId = Read-Host "Enter App Guard batch_id for this build [default]"
if ([string]::IsNullOrWhiteSpace($batchId)) {
  $batchId = "default"
}

python .\scripts\make_build_info.py `
  --app-id my_tool `
  --version 1.0.0 `
  --batch-id $batchId `
  --channel release `
  --endpoint https://your-worker.workers.dev `
  --output .\src\my_tool\build_info.py

python -m PyInstaller .\MyTool.spec
```

## PyInstaller spec 注意事項

如果 `build_info.py` 在 package 內，通常會被 PyInstaller 自動跟進 import。若沒有，請加入 datas 或 hiddenimports。

範例：

```python
hiddenimports=[
    "my_tool.app_guard",
    "my_tool.build_info",
]
```

若使用 `--add-data`，Windows 分隔符是分號：

```powershell
pyinstaller --onefile .\main.py --add-data "build_info.py;."
```

## Nuitka 注意事項

Nuitka 通常會跟隨 import。若 `build_info.py` 是動態讀取或不是 package module，請明確 include：

```powershell
python -m nuitka --onefile --include-data-files=build_info.py=build_info.py .\main.py
```

## BUILD_ID 與 batch_id 差異

- `BUILD_ID`：每次打包自動產生，代表某一個實際產出的檔案或 build。
- `batch_id`：打包時人工輸入，代表這包要發給誰、哪個群組、哪個測試批次或哪個通路。

建議：

- 封鎖單一外流檔案：封鎖 `BUILD_ID`。
- 封鎖整批發出去的對象：封鎖 `batch_id`。
- 觀察版本分布：看 `VERSION`。

## AI Agent 驗證清單

完成整合後，AI agent 必須檢查：

- 入口點最早階段有呼叫 `startup_check(...)`。
- 參數包含 `app_id`、`version`、`build_id`、`batch_id`、`channel`、`endpoint`。
- `timeout_seconds` 不高於 1.5 秒。
- `disabled` 時會停止程式。
- GUI 會用 messagebox 顯示提示。
- CLI 會輸出提示到 stdout/stderr。
- `build_info.py` 會在打包前重產。
- 打包流程會詢問 `batch_id`。
- 不存在硬體指紋、檔案路徑、剪貼簿、瀏覽器資料等敏感資料收集。
- `allow` / `warn` 不會讓下一次啟動跳過遠端檢查。

## 可直接貼給 Codex 的提示

```text
請替這個 Python 專案加入 App Guard 啟動前檢查。請先閱讀 https://github.com/j7johnny/app-guard-template 的 docs/ai-agent-integration.md。

需求：
- 找出真正入口點與打包流程。
- 複製 python-sdk/app_guard.py 到專案內合適位置。
- 新增 build_info.py，欄位包含 APP_ID, VERSION, BUILD_ID, BATCH_ID, CHANNEL, BUILT_AT, GIT_COMMIT, ENDPOINT。
- 新增 scripts/make_build_info.py，在打包前產生 build_info.py。
- 修改 build.bat 或 PowerShell 打包腳本，打包時詢問 batch_id。
- 在入口點最前面呼叫 startup_check，每次啟動都遠端檢查。
- disabled 時顯示訊息並停止；warn 時顯示訊息但繼續。
- timeout_seconds 設為 1.2。
- 不蒐集硬體 ID、使用者資訊、檔案路徑、剪貼簿、瀏覽器資料或命令列參數內容。
- 加入最小測試，確認 payload 欄位、fail-open、disabled 停止、allow 不快取跳過遠端檢查。
```

## 可直接貼給 Claude Code 的提示

```text
Read this repository first: https://github.com/j7johnny/app-guard-template
Follow docs/ai-agent-integration.md exactly.

Integrate App Guard into this Python project:
1. Identify the real entrypoint and packaging script/spec.
2. Copy python-sdk/app_guard.py into the project package.
3. Add build_info.py constants generated by scripts/make_build_info.py.
4. Insert startup_check at the earliest safe startup point.
5. For GUI apps, use tk_messagebox_prompt. For CLI apps, use default_cli_prompt.
6. Ensure every startup calls /check. Do not add allow/warn cache.
7. Keep fail-open by default and timeout around 1.2 seconds.
8. Update build script to prompt for batch_id and generate BUILD_ID automatically.
9. Add focused tests for payload privacy, fail-open, disabled stop, and no allow-cache bypass.

Do not collect hardware identifiers, usernames, emails, file paths, clipboard data, browser data, or command-line argument contents. Do not download or execute remote code.
```
