# 免費額度估算

目前 SDK 預設是「每次啟動都呼叫一次 `/check`」。因此額度估算應該用「每日啟動次數」而不是「每日活躍安裝數」來看。

| 每日啟動次數 | Worker requests/day | KV reads/day | D1 writes/day |
| ---: | ---: | ---: | ---: |
| 100 | 100 | 100 | 100 |
| 1,000 | 1,000 | 1,000 | 1,000 |
| 10,000 | 10,000 | 10,000 | 10,000 |

每次 `/check` 會：

- 讀取一次 KV policy。
- 依規則回傳 `allow`、`warn` 或 `disabled`。
- 依 telemetry 設定寫入一筆 D1 `startup_check` 事件。

## 快取策略

- `allow` 和 `warn` 不會被用來跳過下一次啟動檢查。
- `disabled` 會短期快取，避免已封鎖的 build 在暫時離線時又被放行。
- `next_check_after_seconds` 仍保留在 API 回傳格式中，但 SDK 只把它用於 disabled 快取期限。

## 降低用量

若未來啟動量變大，可在 policy 中降低 telemetry sample rate，讓 `/check` 仍每次判斷，但 D1 事件只抽樣寫入：

```json
{
  "telemetry": {
    "enabled": true,
    "sample_rate": 0.25
  }
}
```

如果需要完全不寫事件，可設為：

```json
{
  "telemetry": {
    "enabled": false
  }
}
```
