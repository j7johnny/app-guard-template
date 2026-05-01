# App Guard Template

這是一套給小型 Python 工具與 Python 打包 EXE 使用的輕量「啟動前檢查」模板。

目標不是做不可破解的 DRM，也不是蒐集使用者資訊，而是用最小資料完成幾件實務上常需要的事：

- 遠端版本控管。
- 短期使用事件紀錄。
- 版本、build、batch 活躍分布統計。
- build 外流觀察。
- 必要時遠端停用指定版本、指定 build 或指定 batch。
- 避免蒐集本機敏感資訊，降低 Windows 11 或防毒軟體警示風險。

## 架構

- `worker/`：Cloudflare Workers + KV + D1 後端。
- `python-sdk/`：單檔 Python SDK，可放入 CLI、GUI 或 PyInstaller EXE 專案。
- `admin_web/`：HTML 管理台，可查詢 App、版本、build/batch，並維護規則。
- `docs/`：中文操作文件與 VibeCoding 套用指南。

## SDK 預設行為

- 每次程式啟動都呼叫一次遠端 `/check`。
- `allow` 和 `warn` 不會被快取成「跳過下次檢查」。
- `disabled` 會短期快取，避免已封鎖的 build 在暫時離線時又被放行。
- 網路失敗預設 fail-open，除非呼叫端設定 `fail_open=False`。
- 不下載、不執行遠端程式碼。
- 不要求使用者輸入 license key。

## 快速流程

1. 部署 Worker 到 Cloudflare。
2. 建立 KV namespace 與 D1 database。
3. 將 `python-sdk/app_guard.py` 複製到你的 Python 專案。
4. 打包時產生 `build_info.py`，包含 `APP_ID`、`VERSION`、`BUILD_ID`、`BATCH_ID`、`CHANNEL`、`ENDPOINT`。
5. 在主程式入口點最前面呼叫 `startup_check(...)`。
6. 用 `admin_web/index.html` 查詢活躍 build/batch 並維護規則。

## 隱私原則

Client 只送最小欄位，例如 app id、version、build id、batch id、channel、SDK version、runtime、platform、隨機 install id。

禁止蒐集姓名、email、帳號、MAC、磁碟序號、Windows SID、硬體指紋、檔案路徑、使用者資料夾、執行參數內容、剪貼簿、瀏覽器資料或完整 user agent。
