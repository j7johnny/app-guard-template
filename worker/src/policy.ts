export type GuardStatus = "allow" | "warn" | "disabled";
export type MessageLevel = "info" | "warning" | "error";

export interface GuardRequest {
  app_id: string;
  version: string;
  build_id?: string;
  batch_id?: string;
  channel?: string;
  sdk_version?: string;
  runtime?: string;
  platform?: string;
  install_id?: string;
  event?: string;
}

export interface GuardResponse {
  status: GuardStatus;
  message: string;
  message_level: MessageLevel;
  disable: boolean;
  min_version: string;
  next_check_after_seconds: number;
  support_url: string;
}

export interface RuleAction {
  status?: GuardStatus;
  message?: string;
  message_level?: MessageLevel;
  disable?: boolean;
  min_version?: string;
  next_check_after_seconds?: number;
  support_url?: string;
}

export interface RuleMatch {
  version?: string;
  version_lt?: string;
  version_lte?: string;
  build_id?: string;
  batch_id?: string;
  channel?: string;
  runtime?: string;
  platform?: string;
}

export interface PolicyRule {
  id: string;
  enabled?: boolean;
  priority?: number;
  match: RuleMatch;
  action: RuleAction;
}

export interface AppPolicy {
  schema_version: 1;
  default?: RuleAction;
  telemetry?: {
    enabled?: boolean;
    sample_rate?: number;
  };
  rules: PolicyRule[];
}

export const DEFAULT_RESPONSE: GuardResponse = {
  status: "allow",
  message: "",
  message_level: "info",
  disable: false,
  min_version: "",
  next_check_after_seconds: 86400,
  support_url: "",
};

export function evaluatePolicy(policy: AppPolicy | null, req: GuardRequest): GuardResponse {
  let response = applyAction(DEFAULT_RESPONSE, policy?.default ?? {});
  const rules = [...(policy?.rules ?? [])]
    .filter((rule) => rule.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const rule of rules) {
    if (!matches(rule.match, req)) continue;
    response = applyAction(response, rule.action);
    break;
  }

  return {
    ...response,
    disable: response.disable || response.status === "disabled",
  };
}

function applyAction(base: GuardResponse, action: RuleAction): GuardResponse {
  const status = action.status ?? base.status;
  return {
    status,
    message: action.message ?? base.message,
    message_level: action.message_level ?? base.message_level,
    disable: action.disable ?? base.disable ?? status === "disabled",
    min_version: action.min_version ?? base.min_version,
    next_check_after_seconds: clampSeconds(
      action.next_check_after_seconds ?? base.next_check_after_seconds,
    ),
    support_url: action.support_url ?? base.support_url,
  };
}

function matches(match: RuleMatch, req: GuardRequest): boolean {
  if (match.version !== undefined && match.version !== req.version) return false;
  if (match.build_id !== undefined && match.build_id !== (req.build_id ?? "")) return false;
  if (match.batch_id !== undefined && match.batch_id !== (req.batch_id ?? "")) return false;
  if (match.channel !== undefined && match.channel !== (req.channel ?? "")) return false;
  if (match.runtime !== undefined && match.runtime !== (req.runtime ?? "")) return false;
  if (match.platform !== undefined && match.platform !== (req.platform ?? "")) return false;
  if (match.version_lt !== undefined && compareVersions(req.version, match.version_lt) >= 0) return false;
  if (match.version_lte !== undefined && compareVersions(req.version, match.version_lte) > 0) return false;
  return true;
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function parseVersion(input: string): number[] {
  return input
    .replace(/^[^\d]*/, "")
    .split(/[.+_-]/)
    .map((part) => {
      const match = /^\d+/.exec(part);
      return match ? Number(match[0]) : 0;
    });
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 86400;
  return Math.max(60, Math.min(604800, Math.floor(value)));
}

export function shouldSample(policy: AppPolicy | null, installId: string | undefined): boolean {
  const telemetry = policy?.telemetry;
  if (telemetry?.enabled === false) return false;
  const sampleRate = telemetry?.sample_rate ?? 1;
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  const key = installId || Math.random().toString(16);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (hash % 10000) / 10000 < sampleRate;
}
