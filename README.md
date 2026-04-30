# App Guard Template

這是一套給小型 Python 工具與 Python 打包 EXE 使用的輕量「啟動前檢查」模板。

它的目標不是做不可破解的 DRM，也不是蒐集使用者資訊，而是用最小資料完成幾件實務上常需要的事：

- 遠端版本政策控管。
- 遠端提示文字。
- 針對特定版本、build、批次或 channel 遠端停用。
- 短期使用事件紀錄。
- 版本與 build 分布統計。
- build 外流或異常活躍觀察。
- 最小化 client metadata。

目前第一個落地目標是通用 Python/EXE 工作流。`social-buddy-release` 只曾作為參考案例，這個模板不依賴也不修改該專案。

## 目錄

- `worker/`：Cloudflare Workers + KV + D1 後端。
- `python-sdk/`：單檔 Python SDK、CLI/GUI 範例與打包範例。
- `docs/`：Codex/VibeCoding 套用指南、隱私說明、配額估算與維運說明。

## 快速開始

1. Worker 已部署於 `https://app-guard.j7johnny1210.workers.dev`。
2. 用 `worker/examples/rules.example.json` 上傳一份政策規則。
3. 把 `python-sdk/app_guard.py` 複製到你的 Python 專案。
4. 打包前產生 `build_info.py`。
5. 在程式入口點最前面加入 `startup_check(...)`。

SDK 預設在網路錯誤時 fail-open，不會下載或執行遠端程式碼。
