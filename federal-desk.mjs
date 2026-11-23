import { createReadStream } from "node:fs";
import { mkdir, appendFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
export const mount = "/federal-desk";
const liveOrigin = "https://synthworx.com";
const sources = new Set([
  "synthworx",
  "search",
  "guide",
  "referral",
  "direct",
  "veterans",
  "career-center",
  "buyer",
  "shared",
]);
const events = new Set([
  "visit",
  "guide_view",
  "example_check",
  "check_complete",
]);
const kinds = new Set(["check", "workspace", "delivery", "guide", "idea"]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};
function answer(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
function redirect(res, status, target) {
  res.writeHead(status, {
    Location: target,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end();
}
function issue(code, message) {
  return Object.assign(new Error(message), { publicStatus: code });
}
async function parse(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    throw issue(415, "Use the form on the Federal Evidence Desk website.");
  const pieces = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10000) throw issue(413, "This entry is too long.");
    pieces.push(chunk);
  }
  try {
    const v = JSON.parse(Buffer.concat(pieces).toString());
    if (!v || Array.isArray(v) || typeof v !== "object") throw Error();
    return v;
  } catch {
    throw issue(400, "The form could not be read.");
  }
}
export function checkoutPayload(product, origin, source) {
  return {
    product_cart: [{ product_id: product, quantity: 1 }],
    billing_address: { country: "US" },
    billing_currency: "USD",
    feature_flags: {
      allow_customer_editing_country: false,
      allow_currency_selection: false,
      allow_discount_code: false,
    },
    return_url: origin + mount + "/delivery",
    metadata: { offer: "federal-evidence-desk-v1", channel: source },
  };
}
export function createFederalDesk(options = {}) {
  const origin = options.origin || liveOrigin;
  const assets = options.assets || path.resolve("dist/federal-desk");
  const state =
    options.state ||
    process.env.FEDERAL_DESK_DATA ||
    path.join(
      process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data",
      "federal-evidence-desk",
    );
  const key = options.key || process.env.FEDERAL_DESK_DODO_KEY?.trim();
  const product = options.product || process.env.FEDERAL_DESK_PRODUCT;
  const api = options.api || "https://live.dodopayments.com";
  const remote = options.fetch || fetch;
  const qaKey = options.qaKey || process.env.FEDERAL_DESK_QA_TOKEN;
  const recent = new Map();
  const isQA = (req) => {
    const submitted = req.headers["x-federal-probe"];
    return (
      typeof qaKey === "string" &&
      typeof submitted === "string" &&
      Buffer.byteLength(qaKey) === Buffer.byteLength(submitted) &&
      timingSafeEqual(Buffer.from(qaKey), Buffer.from(submitted))
    );
  };
  function limit(req, type, max) {
    const now = Date.now();
    const ip = String(
      req.headers["x-real-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "",
    )
      .split(",")
      .at(-1)
      .trim();
    const k = ip + "|" + type;
    if (recent.size > 1200)
      for (const [id, v] of recent) if (v.until <= now) recent.delete(id);
    const row = recent.get(k);
    if (!row || row.until <= now) {
      recent.set(k, { until: now + 600000, n: 1 });
      return;
    }
    if (row.n >= max) throw issue(429, "Please try again in ten minutes.");
    row.n++;
  }
  async function track(name, source, pathname) {
    await mkdir(state, { recursive: true, mode: 0o700 });
    await appendFile(
      path.join(state, "events.ndjson"),
      JSON.stringify({
        at: new Date().toISOString(),
        name,
        source,
        ...(pathname ? { path: pathname } : {}),
      }) + "\n",
      { mode: 0o600 },
    );
  }
  return async function serve(req, res) {
    try {
      const u = new URL(req.url, origin);
      const prefix = mount + "/";
      if (u.pathname === mount) return redirect(res, 308, prefix + u.search);
      if (!u.pathname.startsWith(prefix))
        return answer(res, 404, { message: "Page not found." });
      const part = u.pathname.slice(prefix.length);
      if (part === "delivery" && u.search)
        return redirect(res, 303, prefix + "delivery");
      if (part.startsWith("api/")) {
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          return answer(res, 405, { message: "Use the form on the website." });
        }
        if (req.headers.origin && req.headers.origin !== origin)
          return answer(res, 403, {
            message: "Use the form on the Federal Evidence Desk website.",
          });
        const data = await parse(req);
        const source = sources.has(data.source) ? data.source : "direct";
        const probe = isQA(req);
        if (part === "api/event") {
          limit(req, "event", 100);
          if (!events.has(data.name)) throw issue(400, "Unknown event.");
          const page =
            typeof data.page === "string" &&
            /^\/(?:guides\/[a-z0-9-]+|order|feedback|terms|delivery|guides)?$/.test(
              data.page,
            )
              ? data.page
              : undefined;
          if (!probe) await track(data.name, source, page);
          return answer(res, 200, { ok: true });
        }
        if (part === "api/checkout") {
          if (data.us !== true)
            throw issue(
              422,
              "Checkout is available to U.S. customers with a U.S. billing address.",
            );
          limit(req, "checkout", 12);
          if (!key || !product)
            throw issue(
              503,
              "Checkout is temporarily unavailable. Please try again or email hello@synthworx.com.",
            );
          const result = await remote(api + "/checkouts", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(checkoutPayload(product, origin, source)),
            signal: AbortSignal.timeout(18000),
          });
          if (!result.ok)
            throw Error("Checkout provider returned " + result.status);
          const body = await result.json();
          const target = new URL(body.checkout_url);
          if (
            target.protocol !== "https:" ||
            ![
              "checkout.dodopayments.com",
              "test.checkout.dodopayments.com",
            ].includes(target.hostname)
          )
            throw Error("Unexpected checkout origin");
          if (!probe) await track("checkout_start", source);
          return answer(res, 200, { url: target.href });
        }
        if (part === "api/feedback") {
          limit(req, "feedback", 8);
          if (data.website)
            return answer(res, 201, {
              message: "Thank you for your feedback.",
            });
          const message =
            typeof data.message === "string" ? data.message.trim() : "";
          const email = typeof data.email === "string" ? data.email.trim() : "";
          if (
            !kinds.has(data.kind) ||
            message.length < 5 ||
            message.length > 2000 ||
            email.length > 200 ||
            (email && !/^\S+@\S+\.\S+$/.test(email))
          )
            throw issue(
              422,
              "Check the feedback and your optional reply email.",
            );
          const id = randomUUID();
          const folder = path.join(state, probe ? "qa-feedback" : "feedback");
          await mkdir(folder, { recursive: true, mode: 0o700 });
          await writeFile(
            path.join(folder, id + ".json"),
            JSON.stringify({
              id,
              at: new Date().toISOString(),
              kind: data.kind,
              source,
              message,
              email,
            }),
            { mode: 0o600, flag: "wx", flush: true },
          );
          return answer(res, 201, {
            ok: true,
            message:
              "Thank you. Your feedback has reached Federal Evidence Desk.",
          });
        }
        return answer(res, 404, { message: "Page not found." });
      }
      if (!["GET", "HEAD"].includes(req.method))
        return answer(res, 405, { message: "Method not allowed." });
      if (part.endsWith("/"))
        return redirect(res, 308, prefix + part.slice(0, -1) + u.search);
      if (
        part &&
        !/^(?:[a-zA-Z0-9-]+\/)*[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9]+)?$/.test(part)
      )
        return answer(res, 404, { message: "Page not found." });
      if (part.endsWith(".html") || part === "index")
        return redirect(
          res,
          308,
          prefix +
            (part.replace(/\.html$/, "") === "index"
              ? ""
              : part.replace(/\.html$/, "")) +
            u.search,
        );
      const name = !part
        ? "index.html"
        : path.extname(part)
          ? part
          : part + ".html";
      const type = mime[path.extname(name)];
      if (!type) return answer(res, 404, { message: "Page not found." });
      const target = path.join(assets, name);
      let info;
      try {
        info = await stat(target);
      } catch (err) {
        if (err.code === "ENOENT")
          return answer(res, 404, { message: "Page not found." });
        throw err;
      }
      if (!info.isFile())
        return answer(res, 404, { message: "Page not found." });
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": info.size,
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
      });
      if (req.method === "HEAD") return res.end();
      await pipeline(createReadStream(target), res);
    } catch (error) {
      if (
        !error.publicStatus &&
        !["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET"].includes(error.code)
      )
        console.error(
          "Federal Evidence Desk request failed:",
          error.message?.replace(/https?:\/\/\S+/g, "[provider]"),
        );
      if (!res.headersSent)
        answer(res, error.publicStatus || 503, {
          message: error.publicStatus
            ? error.message
            : "The service is temporarily unavailable. Please try again or email hello@synthworx.com.",
        });
      else res.end();
    }
  };
}
