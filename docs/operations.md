# 維運操作

## 建立 Cloudflare 資源

```powershell
cd worker
Copy-Item wrangler.toml.example wrangler.toml
wrangler kv namespace create APP_GUARD_RULES
wrangler d1 create app_guard_events
wrangler secret put ADMIN_TOKEN
wrangler d1 migrations apply app_guard_events --remote
wrangler deploy
```

Cloudflare 會回傳 KV namespace ID 與 D1 database ID。請把這些值填進 `wrangler.toml`。

## 上傳規則

```powershell
node .\tools\push-rules.mjs https://your-worker.workers.dev $env:APP_GUARD_ADMIN_TOKEN .\examples\rules.example.json
```

## 查詢統計

```powershell
node .\tools\get-stats.mjs https://your-worker.workers.dev $env:APP_GUARD_ADMIN_TOKEN my_tool 30
```

這會查詢 `my_tool` 最近 30 天的版本分布、build 分布與每日活躍摘要。

## 停用外流 build

在政策 JSON 中加入高 priority 規則：

```json
{
  "id": "disable-leaked-build",
  "enabled": true,
  "priority": 100,
  "match": { "build_id": "20260430-leaked" },
  "action": {
    "status": "disabled",
    "disable": true,
    "message_level": "error",
    "message": "此版本已停止使用。請向提供者索取新版。",
    "next_check_after_seconds": 3600
  }
}
```

已經快取到這個停用決策的 client，會在 disabled cache 到期前持續停用。若要恢復使用，請移除或停用該規則，並等待 client 下次檢查。
