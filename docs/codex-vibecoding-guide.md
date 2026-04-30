# Codex / VibeCoding 套用指南

把 App Guard 套到任一 Python 專案時，可以直接把下面這段交給 Codex 或其他 VibeCoding 工具：

```text
請替這個 Python 專案加入 App Guard 啟動前檢查。

規則：
- 先找出真正的程式入口點，不要猜。
- 將 app_guard.py 複製到專案中，或使用既有的本機 SDK。
- 新增 build_info.py 常數：APP_ID, VERSION, BUILD_ID, BATCH_ID, CHANNEL, ENDPOINT。
- 在入口點最前面呼叫 startup_check，位置要早於耗時工作或主要功能啟動。
- 如果 result.disabled 為 true，顯示 result.message，然後以 exit code 1 結束。
- 如果 result.warning 為 true，顯示 result.message，然後繼續執行。
- 不得蒐集硬體 ID、使用者名稱、email、檔案路徑、剪貼簿、瀏覽器資料、命令列參數內容或完整 user agent。
- 不得下載或執行遠端程式碼。
- 網路 timeout 要低於 1.5 秒。
- 除非明確要求，保留 fail-open 行為。
```

## 最小插入片段

```python
from app_guard import exit_if_disabled, startup_check
from build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION

guard = startup_check(
    app_id=APP_ID,
    version=VERSION,
    build_id=BUILD_ID,
    batch_id=BATCH_ID,
    channel=CHANNEL,
    endpoint=ENDPOINT,
)
exit_if_disabled(guard)
```

## GUI 程式

GUI 程式可以改用：

```python
from app_guard import tk_messagebox_prompt
```

並在 `startup_check(...)` 傳入：

```python
prompt_handler=tk_messagebox_prompt
```

這樣遠端提示或停用訊息會用對話框顯示，而不是印在 console。
