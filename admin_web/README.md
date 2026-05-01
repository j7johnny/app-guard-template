# App Guard HTML 管理台

建議優先使用這個 HTML 管理台，而不是 Python/Tk GUI。

原因：

- 不需要安裝套件。
- 不受 Python / Tkinter 版本影響。
- 比較適合維護規則表、版本控管和刪除規則。
- 可以直接用瀏覽器開啟。

## 開啟方式

直接用瀏覽器開啟：

```text
C:\Users\j7johnny\Desktop\GithubResearch\app-guard-template\admin_web\index.html
```

第一次使用時貼上 `.dev.vars` 裡面的 `ADMIN_TOKEN`。瀏覽器會把 Endpoint 和 Token 存在本機 localStorage，之後不用每次重填。

## 功能

- 載入全部 App，不必先輸入 App ID。
- 查詢選取 App 的版本分布。
- 查詢活躍 `BUILD_ID` / `batch_id`。
- 封鎖選取 `BUILD_ID`。
- 封鎖選取 `batch_id`。
- 建立「低於指定版本就警告」規則。
- 建立「指定版本停用」規則。
- 啟用、停用、刪除既有規則。
- 進階模式可直接編輯 Policy JSON。
