# 免費額度估算

假設每個安裝每天只呼叫一次 `/check`，因為 SDK 會快取下一次檢查時間。

| 每日活躍安裝數 | Worker requests/day | KV reads/day | D1 writes/day |
| ---: | ---: | ---: | ---: |
| 100 | 100 | 100 | 100 |
| 1,000 | 1,000 | 1,000 | 1,000 |
| 10,000 | 10,000 | 10,000 | 10,000 |

Cloudflare Workers Free 有每日 request 額度，KV Free 適合讀多寫少的政策資料；事件紀錄與統計建議放 D1，避免把 KV 當事件資料庫使用。

## 設計原則

- client cache 是必要設計，不要每個功能呼叫都打 API。
- 政策寫入應該很少發生，且只能透過 admin API。
- `/event` 是可選 API；`/check` 已經會記錄 `startup_check`。
- 若發佈規模變大，可在政策中降低 telemetry sample rate：

```json
{
  "telemetry": {
    "enabled": true,
    "sample_rate": 0.25
  }
}
```

如果流量接近免費額度，優先降低事件取樣率，保留 `/check` 的基本版本控管能力。
