# App Guard Python SDK

`app_guard.py` 是單檔 Python SDK，可直接放進 Python 腳本或 Python 打包成的 EXE 工具中。

## 最小整合方式

把 `app_guard.py` 與產生好的 `build_info.py` 放進你的專案，然後在程式入口點最前面加入：

```python
from app_guard import exit_if_disabled, startup_check
from build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION

result = startup_check(
    app_id=APP_ID,
    version=VERSION,
    build_id=BUILD_ID,
    batch_id=BATCH_ID,
    channel=CHANNEL,
    endpoint=ENDPOINT,
)
exit_if_disabled(result)
```

如果遠端政策回傳 `disabled`，`exit_if_disabled(result)` 會停止程式。若只回傳 `warn`，SDK 會顯示提示後繼續執行。

## 隱私邊界

SDK 只送出下列欄位：

- `app_id`
- `version`
- `build_id`
- `batch_id`
- `channel`
- `sdk_version`
- `runtime`
- `platform`
- 本機隨機產生的 `install_id`
- `event=startup_check`

SDK 不會讀取或送出姓名、email、檔案路徑、硬體序號、Windows SID、瀏覽器資料、剪貼簿資料或命令列參數內容。

## Build Info

打包前先產生 build metadata：

```powershell
python .\examples\make_build_info.py --app-id my_tool --version 1.0.0 --batch-id friend-group-a --endpoint https://replace-with-your-worker.workers.dev --output .\build_info.py
```

建議每次提供檔案給不同對象或批次時，都使用不同的 `batch_id` 或 `build_id`，方便觀察外流與活躍狀況。

## 打包

範例：

- `examples/pyinstaller.ps1`
- `examples/nuitka.ps1`

未簽章 EXE 又帶有網路請求時，較容易被 Windows Defender 或防毒軟體警示。若會提供給較多人使用，建議使用正常 code signing 流程。

## 測試

```powershell
python -m unittest discover -s .\tests
```
