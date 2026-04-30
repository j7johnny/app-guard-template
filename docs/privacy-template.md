# 隱私說明範本

本程式會在啟動時進行一次輕量檢查，用來確認目前版本或 build 是否有更新提示、停止使用通知或其他必要公告。

啟動檢查只會送出：

- app id；
- app version；
- build id；
- batch id；
- release channel；
- SDK version；
- runtime type；
- 作業系統類型；
- 本機隨機產生的 install id；
- 事件類型 `startup_check`。

本程式不會送出：

- 姓名、email、帳號 id 或 license key；
- 硬體序號、MAC address、Windows SID 或裝置指紋；
- 檔案路徑、使用者資料夾名稱、命令列參數內容或本機文件名稱；
- 剪貼簿內容；
- 瀏覽器歷史紀錄或目前頁面 URL；
- 鍵盤輸入或螢幕內容。

`install_id` 是在本機隨機產生，不是由硬體資訊推導。它只用於估算活躍安裝數，以及觀察特定版本或 build 是否仍在使用。

遠端回應只會是結構化政策 JSON。本程式不會下載或執行遠端程式碼。
