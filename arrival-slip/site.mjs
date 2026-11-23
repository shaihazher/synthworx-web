import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import live from "./live.json" with { type: "json" };
const mount = "/arrival-slip/";
const channels = new Set([
  "agency-email",
  "editorial",
  "directory",
  "search",
  "referral",
  "qa",
  "direct",
]);
const events = new Set(["page", "sample", "desk", "filed", "print", "report"]);
const staticFiles = new Set([
  "206ccb29830c09e5f161e048d904fa8f.txt",
  "style.css",
  "common.js",
  "desk.js",
  "sample.js",
  "record.js",
  "storage.js",
  "carbon.webp",
  "mark.svg",
  "archivo.woff2",
  "inter.woff2",
  "archivo-license.txt",
  "inter-license.txt",
  "arrival-slip-capture.zip",
  "sitemap.xml",
]);
const pages = new Set([
  "index",
  "desk",
  "sample",
  "support",
  "terms",
  "helper",
]);
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  webp: "image/webp",
  svg: "image/svg+xml",
  xml: "application/xml",
  zip: "application/zip",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
};
function issue(status, message) {
  return Object.assign(Error(message), { status });
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
    throw issue(415, "Send JSON from the receipt book.");
  let size = 0;
  const parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > 1600) throw issue(413, "Request too large.");
    parts.push(part);
  }
  try {
    const obj = JSON.parse(Buffer.concat(parts));
    if (!obj || Array.isArray(obj) || typeof obj !== "object") throw Error();
    return obj;
  } catch {
    throw issue(400, "Could not read the request.");
  }
}
export function createArrivalSite(options = {}) {
  const origin = options.origin || "https://synthworx.com",
    config = options.catalog || live;
  const mode = config.mode,
    billingBase = "https://" + mode + ".dodopayments.com";
  const remote = options.fetch || fetch;
  const publicDir = options.assets || resolve("dist/arrival-slip");
  const dataDir =
    options.data ||
    join(process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data", "arrival-slip");
  const merchant =
    options.merchant || process.env.ARRIVAL_DODO_KEY || process.env.OP_DODO_KEY;
  let db, cookieKey;
  const limits = new Map(),
    activations = new Map();
  function open() {
    if (db) return db;
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    db = new DatabaseSync(join(dataDir, "business.sqlite"));
    db.exec(
      "PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS counters(day TEXT,source TEXT,event TEXT,n INTEGER,PRIMARY KEY(day,source,event));CREATE TABLE IF NOT EXISTS config(id INTEGER PRIMARY KEY,secret BLOB);CREATE TABLE IF NOT EXISTS licenses(hash TEXT PRIMARY KEY,instance TEXT,checked INTEGER)",
    );
    db.prepare("INSERT OR IGNORE INTO config VALUES(1,?)").run(randomBytes(32));
    cookieKey = Buffer.from(
      db.prepare("SELECT secret FROM config WHERE id=1").get().secret,
    );
    return db;
  }
  function count(event, source) {
    open()
      .prepare(
        "INSERT INTO counters VALUES(?,?,?,1) ON CONFLICT(day,source,event) DO UPDATE SET n=n+1",
      )
      .run(
        new Date().toISOString().slice(0, 10),
        channels.has(source) ? source : "direct",
        event,
      );
  }
  function seal(value) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", cookieKey, iv);
    const bytes = Buffer.concat([
      c.update(JSON.stringify(value), "utf8"),
      c.final(),
    ]);
    return Buffer.concat([iv, c.getAuthTag(), bytes]).toString("base64url");
  }
  function unseal(req) {
    const token = (req.headers.cookie || "").match(
      /(?:^|;\s*)arrival_book=([A-Za-z0-9_-]{32,1024})(?:;|$)/,
    )?.[1];
    if (!token) return null;
    try {
      open();
      const b = Buffer.from(token, "base64url");
      const c = createDecipheriv("aes-256-gcm", cookieKey, b.subarray(0, 12));
      c.setAuthTag(b.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(),
      );
    } catch {
      return null;
    }
  }
  const hash = (key) => createHash("sha256").update(key).digest("hex");
  async function provider(action, payload) {
    const r = await remote(billingBase + "/licenses/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10500),
    });
    if ([400, 401, 403, 404, 422].includes(r.status))
      throw issue(
        403,
        "That key did not open Arrival Slip Studio. Check your purchase email.",
      );
    if (!r.ok)
      throw issue(
        503,
        "Dodo Payments is temporarily unavailable. Please try again.",
      );
    return r.status === 204 ? {} : r.json();
  }
  async function valid(key, instance, force) {
    const row = open()
      .prepare("SELECT instance,checked FROM licenses WHERE hash=?")
      .get(hash(key));
    if (!row || row.instance !== instance) return false;
    if (!force && Date.now() - row.checked < 300000) return true;
    let check;
    try {
      check = await provider("validate", {
        license_key: key,
        license_key_instance_id: instance,
      });
    } catch (e) {
      if (e.status === 403) return false;
      throw e;
    }
    if (!check.valid) {
      db.prepare("UPDATE licenses SET checked=0 WHERE hash=?").run(hash(key));
      return false;
    }
    db.prepare("UPDATE licenses SET checked=? WHERE hash=?").run(
      Date.now(),
      hash(key),
    );
    return true;
  }
  async function activate(key) {
    const digest = hash(key);
    if (activations.has(digest)) return activations.get(digest);
    const task = (async () => {
      const existing = open()
        .prepare("SELECT instance FROM licenses WHERE hash=?")
        .get(digest);
      if (existing) {
        if (await valid(key, existing.instance, true)) return existing.instance;
        throw issue(
          403,
          "Your Studio access is inactive. Check your subscription in the billing portal.",
        );
      }
      const act = await provider("activate", {
        license_key: key,
        name: "Arrival Slip Studio receipt book",
      });
      if (!act.id || act.product?.product_id !== config.productId) {
        if (act.id)
          await provider("deactivate", {
            license_key: key,
            license_key_instance_id: act.id,
          }).catch(() => {});
        throw issue(403, "This key belongs to a different product.");
      }
      db.prepare("INSERT OR REPLACE INTO licenses VALUES(?,?,?)").run(
        digest,
        act.id,
        Date.now(),
      );
      return act.id;
    })();
    activations.set(digest, task);
    try {
      return await task;
    } finally {
      activations.delete(digest);
    }
  }
  function rate(req, action, max) {
    const ip = String(
      req.headers["x-real-ip"] ||
        req.headers["x-forwarded-for"]?.split(",").at(-1) ||
        req.socket.remoteAddress,
    );
    const now = Date.now(),
      k = action + ":" + ip,
      prior = limits.get(k);
    if (!prior || prior.end < now) {
      if (limits.size > 1500)
        for (const [id, v] of limits) if (v.end < now) limits.delete(id);
      limits.set(k, { end: now + 60000, n: 1 });
      return;
    }
    if (++prior.n > max)
      throw issue(429, "Please wait a minute before trying again.");
  }
  async function checkout(source) {
    const base =
      mode === "live"
        ? "checkout.dodopayments.com"
        : "test.checkout.dodopayments.com";
    if (!merchant) {
      const u = new URL("https://" + base + "/buy/" + config.productId);
      u.searchParams.set("quantity", "1");
      u.searchParams.set("redirect_url", origin + mount + "welcome");
      return u.href;
    }
    const r = await remote(billingBase + "/checkouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + merchant,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: config.productId, quantity: 1 }],
        billing_currency: "USD",
        feature_flags: {
          allow_discount_code: false,
          allow_currency_selection: false,
        },
        metadata: { offer: "arrival-slip-studio", channel: source },
        return_url: origin + mount + "welcome",
        cancel_url: origin + mount + "#studio",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw issue(
        503,
        "Checkout could not start. Please try again or contact hello@synthworx.com.",
      );
    const u = new URL((await r.json()).checkout_url);
    if (u.protocol !== "https:" || u.hostname !== base)
      throw Error("Invalid checkout URL");
    return u.href;
  }
  return async function arrival(req, res) {
    const json = (st, v) => {
      res.writeHead(st, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(v));
    };
    const redirect = (st, url) => {
      res.writeHead(st, { Location: url });
      res.end();
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const u = new URL(req.url, origin),
        part = u.pathname.slice(mount.length);
      if (u.pathname === mount.slice(0, -1))
        return redirect(308, mount + u.search);
      const get = req.method === "GET" || req.method === "HEAD";
      if (part === "welcome" && get)
        return redirect(303, mount + "desk?unlock=1");
      if (part === "buy" && get) {
        rate(req, "checkout", 20);
        const source = channels.has(u.searchParams.get("src"))
          ? u.searchParams.get("src")
          : "direct";
        const url = await checkout(source);
        count("checkout", source);
        return redirect(303, url);
      }
      if (part === "api/access" && get) {
        const c = unseal(req);
        return json(200, {
          studio: !!c && (await valid(c.key, c.instance, false)),
        });
      }
      if (part === "api/studio.js" && get) {
        const c = unseal(req);
        if (!c || !(await valid(c.key, c.instance, false)))
          throw issue(403, "Studio access is required.");
        const module = await readFile(new URL("./studio.js", import.meta.url));
        res.writeHead(200, { "Content-Type": types.js });
        return res.end(req.method === "HEAD" ? undefined : module);
      }
      if (part.startsWith("api/")) {
        if (req.method !== "POST")
          throw issue(405, "Use the receipt book for this request.");
        if (req.headers.origin !== origin)
          throw issue(403, "Open the workspace on Synthworx.");
        if (part !== "api/event" && part !== "api/activate")
          throw issue(404, "Unknown action.");
        rate(req, part, part === "api/activate" ? 12 : 180);
        const input = await body(req);
        if (part === "api/event") {
          if (!events.has(input.event)) throw issue(400, "Unknown event.");
          count(input.event, input.source);
          return json(200, { ok: true });
        }
        if (!/^[A-Za-z0-9_-]{12,180}$/.test(input.key || ""))
          throw issue(400, "Enter the license key from your Dodo receipt.");
        const instance = await activate(input.key);
        count("activate", input.source);
        res.setHeader(
          "Set-Cookie",
          "arrival_book=" +
            seal({ key: input.key, instance }) +
            "; Path=" +
            mount +
            "; HttpOnly; SameSite=Strict; Max-Age=31536000" +
            (origin.startsWith("https:") ? "; Secure" : ""),
        );
        return json(200, { studio: true });
      }
      if (!get) throw issue(405, "Use GET to open this page.");
      const page = part || "index",
        file = pages.has(page)
          ? page + ".html"
          : staticFiles.has(part)
            ? part
            : null;
      if (!file) throw issue(404, "Page unavailable.");
      const bytes = await readFile(join(publicDir, file));
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      if (file.endsWith(".zip"))
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="arrival-slip-capture.zip"',
        );
      res.writeHead(200, {
        "Content-Type": types[file.split(".").pop()],
        "Content-Length": bytes.length,
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (e) {
      if (!e.status && e.code !== "ENOENT")
        console.error("Arrival Slip request failed", e.name);
      if (!res.headersSent)
        json(e.status || (e.code === "ENOENT" ? 404 : 503), {
          message: e.status
            ? e.message
            : "The request could not be completed. Please try again.",
        });
      else res.end();
    }
  };
}
