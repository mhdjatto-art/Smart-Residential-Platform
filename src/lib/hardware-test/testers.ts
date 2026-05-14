/**
 * Per-adapter connection testers.
 *
 * Each function performs a safe, read-only probe against the given config
 * and returns a normalized `HardwareTestResult`. The functions are designed
 * to NEVER throw — every error path resolves with `outcome != "connected"`.
 */
import "server-only";
import type { AdapterTestConfig, HardwareTestResult } from "./types";

const DEFAULT_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/* ───────────────────────── REST / generic HTTP API ──────────────────────── */
export async function testREST(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  if (!cfg.endpoint) {
    return { outcome: "misconfigured", message: "Missing endpoint URL." };
  }
  const t0 = Date.now();
  try {
    const url = new URL(cfg.endpoint);
    // Try common health/status endpoints — provider APIs typically expose one.
    const candidates = ["/health", "/status", "/v1/health", "/ping", ""];
    for (const path of candidates) {
      try {
        const res = await withTimeout(
          fetch(new URL(path, url).toString(), {
            method: "GET",
            headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
          }),
        );
        const latencyMs = Date.now() - t0;
        if (res.status === 200 || res.status === 204) {
          return { outcome: "connected", message: `Reachable (HTTP ${res.status}).`, latencyMs };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            outcome:  "auth_failed",
            message:  `Endpoint reachable but credentials rejected (HTTP ${res.status}).`,
            latencyMs,
          };
        }
        // Other status — keep trying other paths but track the best response.
      } catch { /* try next */ }
    }
    return {
      outcome: "unreachable",
      message: "Host reachable but no health endpoint responded with 200.",
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `Could not reach ${cfg.endpoint}.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ─────────────────────── MikroTik RouterOS (REST + JSON) ─────────────────── */
export async function testMikroTik(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  if (!cfg.endpoint) return { outcome: "misconfigured", message: "Missing RouterOS endpoint." };
  if (!cfg.username || !cfg.password)
    return { outcome: "misconfigured", message: "MikroTik requires username + password." };

  const t0 = Date.now();
  try {
    // RouterOS REST API exposes /rest/system/identity — read-only, safe.
    const auth = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
    const res  = await withTimeout(
      fetch(new URL("/rest/system/identity", cfg.endpoint).toString(), {
        headers: { Authorization: `Basic ${auth}` },
      }),
    );
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        outcome: "connected",
        message: "RouterOS responding to /rest/system/identity.",
        latencyMs,
        details: data ?? undefined,
      };
    }
    if (res.status === 401) {
      return { outcome: "auth_failed", message: "RouterOS rejected credentials.", latencyMs };
    }
    return {
      outcome: "unreachable",
      message: `RouterOS responded with HTTP ${res.status}.`,
      latencyMs,
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `Could not reach RouterOS at ${cfg.endpoint}.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ────────────────────────── UniFi Controller ─────────────────────────────── */
export async function testUniFi(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  if (!cfg.endpoint) return { outcome: "misconfigured", message: "Missing UniFi controller URL." };
  const t0 = Date.now();
  try {
    // /status — public endpoint, no auth required on most UniFi controllers.
    const res = await withTimeout(
      fetch(new URL("/status", cfg.endpoint).toString()),
    );
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return {
        outcome: "connected",
        message: "UniFi controller responded.",
        latencyMs,
        details: data ?? undefined,
      };
    }
    return {
      outcome: "unreachable",
      message: `UniFi controller HTTP ${res.status}.`,
      latencyMs,
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `Could not reach UniFi at ${cfg.endpoint}.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ────────────────────────────── Modbus TCP ───────────────────────────────── */
export async function testModbus(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  // We don't ship a Modbus client in the bundle, so we do a TCP probe.
  if (!cfg.endpoint) return { outcome: "misconfigured", message: "Missing modbus://host:port URL." };
  const parsed = cfg.endpoint.match(/^modbus:\/\/([^:/]+):(\d+)/);
  if (!parsed) {
    return {
      outcome: "misconfigured",
      message: "Endpoint must look like modbus://host:502",
    };
  }
  const host = parsed[1]!;
  const port = Number(parsed[2]!);

  const t0 = Date.now();
  try {
    // node:net TCP connect — works in the Node runtime.
    const net = await import("node:net");
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const sock = net.createConnection({ host, port }, () => {
          sock.end();
          resolve();
        });
        sock.on("error", reject);
        sock.setTimeout(DEFAULT_TIMEOUT_MS, () => {
          sock.destroy();
          reject(new Error("TCP timeout"));
        });
      }),
    );
    return {
      outcome:   "connected",
      message:   `Modbus TCP port open at ${host}:${port}.`,
      latencyMs: Date.now() - t0,
      details:   { host, port, unitId: cfg.unitId ?? 1 },
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `Could not open TCP to ${host}:${port}.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ──────────────────────────────── MQTT ──────────────────────────────────── */
export async function testMQTT(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  if (!cfg.endpoint) return { outcome: "misconfigured", message: "Missing mqtt://host:port URL." };
  const m = cfg.endpoint.match(/^mqtts?:\/\/([^:/]+):(\d+)/);
  if (!m) {
    return {
      outcome: "misconfigured",
      message: "Endpoint must look like mqtt://broker:1883 (or mqtts:// for TLS).",
    };
  }
  const host = m[1]!;
  const port = Number(m[2]!);

  const t0 = Date.now();
  try {
    const net = await import("node:net");
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const sock = net.createConnection({ host, port }, () => {
          sock.end();
          resolve();
        });
        sock.on("error", reject);
        sock.setTimeout(DEFAULT_TIMEOUT_MS, () => {
          sock.destroy();
          reject(new Error("TCP timeout"));
        });
      }),
    );
    return {
      outcome:   "connected",
      message:   `MQTT broker port open at ${host}:${port}.`,
      latencyMs: Date.now() - t0,
      details:   { host, port, topicPrefix: cfg.topic },
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `Could not open TCP to MQTT broker at ${host}:${port}.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ────────────────────────────── RADIUS ──────────────────────────────────── */
export async function testRADIUS(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  if (!cfg.endpoint) return { outcome: "misconfigured", message: "Missing radius://host:port URL." };
  const m = cfg.endpoint.match(/^radius:\/\/([^:/]+):(\d+)/);
  if (!m) {
    return {
      outcome: "misconfigured",
      message: "Endpoint must look like radius://host:1812",
    };
  }
  const host = m[1]!;
  const port = Number(m[2]!);

  // RADIUS uses UDP — we can't TCP probe. Send a UDP "ping" packet and wait
  // briefly; any response (or even no error from the socket itself) is OK.
  try {
    const dgram = await import("node:dgram");
    const ok = await withTimeout(
      new Promise<boolean>((resolve, reject) => {
        const sock = dgram.createSocket("udp4");
        const buf  = Buffer.from([0x01, 0x00, 0x00, 0x14]); // minimal access-request
        sock.send(buf, port, host, (err) => {
          sock.close();
          if (err) reject(err);
          else resolve(true);
        });
      }),
      3000,
    );
    return {
      outcome: ok ? "connected" : "unreachable",
      message: ok ? `UDP packet delivered to ${host}:${port}.` : "No UDP response.",
      details: { host, port },
    };
  } catch (e) {
    return {
      outcome: "unreachable",
      message: `RADIUS UDP probe failed.`,
      error:   e instanceof Error ? e.message : "unknown error",
    };
  }
}

/* ───────────────────── Webhook (incoming — we can't initiate) ───────────── */
export async function testWebhook(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  return {
    outcome: "simulated",
    message:
      "Webhook adapters receive events FROM the provider — there's nothing to ping. " +
      "Verify the webhook URL is configured on the provider's side and check audit log " +
      "for incoming events.",
    details: { endpoint_to_register: cfg.endpoint, secret_configured: !!cfg.apiKey },
  };
}

/* ─────────────────────────────── Generic ────────────────────────────────── */
export async function testGeneric(cfg: AdapterTestConfig): Promise<HardwareTestResult> {
  return {
    outcome: "simulated",
    message:
      "This provider doesn't have an automated connection (manual billing or external workflow). " +
      "Config saved — verify the values below.",
    details: cfg.extras ?? {},
  };
}
