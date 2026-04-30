#!/usr/bin/env node
const [endpoint, token, appId, days = "30"] = process.argv.slice(2);
if (!endpoint || !token || !appId) {
  console.error("usage: node tools/get-stats.mjs <worker-endpoint> <admin-token> <app-id> [days]");
  process.exit(1);
}

const url = new URL(`${endpoint.replace(/\/$/, "")}/admin/stats`);
url.searchParams.set("app_id", appId);
url.searchParams.set("days", days);

const res = await fetch(url, {
  headers: { "authorization": `Bearer ${token}` },
});

console.log(await res.text());
if (!res.ok) process.exit(1);
