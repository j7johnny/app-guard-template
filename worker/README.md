# App Guard Worker

這是 App Guard 的 Cloudflare Worker 後端，用於輕量啟動檢查、遠端提示、遠端停用規則與短期使用統計。

## Cloudflare 綁定

- `APP_GUARD_RULES`：KV namespace，用來保存政策 JSON。
- `APP_GUARD_DB`：D1 database，用來保存事件與統計資料。
- `ADMIN_TOKEN`：Worker secret，用來保護管理 API。

## 部署

```powershell
Copy-Item wrangler.toml.example wrangler.toml
wrangler kv namespace create APP_GUARD_RULES
wrangler d1 create app_guard_events
wrangler secret put ADMIN_TOKEN
wrangler d1 migrations apply app_guard_events --remote
wrangler deploy
```

Cloudflare 建立 KV 與 D1 後會回傳 ID，請把這些 ID 填回 `wrangler.toml`。

## API

`POST /check`

啟動檢查 API。只接受白名單欄位，並回傳固定格式的決策：

```json
{
  "status": "allow",
  "message": "",
  "message_level": "info",
  "disable": false,
  "min_version": "",
  "next_check_after_seconds": 86400,
  "support_url": ""
}
```

`status` 可為：

- `allow`：允許使用。
- `warn`：允許使用，但顯示提示文字。
- `disabled`：應停止執行或停用主要功能。

`POST /event`

可選事件 API。一般情況不需要額外呼叫，因為 `/check` 已經會記錄 `startup_check`。

`POST /admin/rules`

管理 API，需帶：

```text
Authorization: Bearer <ADMIN_TOKEN>
```

此 API 會把指定 app 的政策寫入 KV，key 格式為 `app:<app_id>:policy`。

`GET /admin/stats?app_id=my_tool&days=30`

管理 API，需帶 `Authorization: Bearer <ADMIN_TOKEN>`。回傳版本分布、build 分布與每日活躍摘要。
