#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [endpoint, token, file] = process.argv.slice(2);
if (!endpoint || !token || !file) {
  console.error("usage: node tools/push-rules.mjs <worker-endpoint> <admin-token> <rules.json>");
  process.exit(1);
}

const body = await readFile(file, "utf8");
const res = await fetch(`${endpoint.replace(/\/$/, "")}/admin/rules`, {
  method: "POST",
  headers: {
    "authorization": `Bearer ${token}`,
    "content-type": "application/json; charset=utf-8",
  },
  body,
});

console.log(await res.text());
if (!res.ok) process.exit(1);
