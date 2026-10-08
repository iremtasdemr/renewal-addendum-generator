const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const COOKIE = "__Host-renewal-session";
const SESSION_SECONDS = 8 * 60 * 60;
const files = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "application/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/pricing-data.js": ["pricing-data.js", "application/javascript; charset=utf-8"],
  "/assets/jotform-mark-hd.png": ["assets/jotform-mark-hd.png", "image/png"],
  "/assets/jotform-mark.png": ["assets/jotform-mark.png", "image/png"],
  "/assets/jotform-wordmark.png": ["assets/jotform-wordmark.png", "image/png"],
};

function equal(a, b) {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

function sign(payload, password) {
  return crypto.createHmac("sha256", password).update(payload).digest("base64url");
}

function authorized(req, password) {
  const cookie = (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(COOKIE + "="));
  if (!cookie) return false;
  const [payload, signature, extra] = cookie.slice(COOKIE.length + 1).split(".");
  if (!payload || !signature || extra || !equal(signature, sign(payload, password))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isSafeInteger(session.expires) && session.expires > Date.now() && session.expires <= Date.now() + SESSION_SECONDS * 1000;
  } catch { return false; }
}

function page(message = "", disabled = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Renewal Addendum Generator — Sign in</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f5fd;font:16px system-ui;color:#17154e}main{width:min(380px,calc(100vw - 72px));padding:32px;background:white;border:1px solid #e4dbf3;border-radius:16px;box-shadow:0 12px 35px #17154e0b}h1{font-size:24px;line-height:1.3}p{color:#596273;line-height:1.5}label{display:block;font-weight:600}input,button{box-sizing:border-box;width:100%;padding:12px;font:inherit;border-radius:8px;margin-top:12px}input{border:1px solid #c9d0dd}button{background:#10104e;color:white;border:0;cursor:pointer}.message{color:#a12b36}button:disabled{opacity:.5}</style></head><body><main><h1>Renewal Addendum Generator</h1><p>Enter the team password to continue.</p>${message ? `<p class="message" role="alert">${message}</p>` : ""}<form method="post" action="/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024" ${disabled ? "disabled" : "autofocus"}><button ${disabled ? "disabled" : ""}>Sign in</button></form></main></body></html>`;
}

async function readPassword(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/x-www-form-urlencoded")) return "";
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return typeof req.body.password === "string" ? req.body.password.slice(0, 1024) : "";
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 8192) throw new Error("Body too large");
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }
  if (Buffer.byteLength(body) > 8192) return "";
  return (new URLSearchParams(body.toString()).get("password") || "").slice(0, 1024);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  const password = process.env.RENEWAL_PASSWORD;
  if (!password || password.length < 12) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(page("The team password has not been configured. Please contact the site owner.", true));
  }
  const url = new URL(req.url, "https://localhost");
  const resource = req.query?.resource ?? url.searchParams.get("resource");
  const pathname = resource === undefined || resource === null ? url.pathname : "/" + String(resource).replace(/^\/+/, "");
  if (req.method === "POST") {
    const host = req.headers.host;
    if (req.headers.origin !== "https://" + host) {
      res.statusCode = 403;
      return res.end("Request rejected.");
    }
    if (pathname === "/logout") {
      res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      res.statusCode = 303;
      res.setHeader("Location", "/");
      return res.end();
    }
    if (pathname !== "/login") {
      res.statusCode = 405;
      return res.end("Method not allowed.");
    }
    let submitted = "";
    try { submitted = await readPassword(req); } catch { /* Reject oversized input. */ }
    if (!equal(submitted, password)) {
      await new Promise(resolve => setTimeout(resolve, 500));
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(page("Incorrect password. Please try again."));
    }
    const payload = Buffer.from(JSON.stringify({expires: Date.now() + SESSION_SECONDS * 1000, nonce: crypto.randomBytes(16).toString("hex")})).toString("base64url");
    res.setHeader("Set-Cookie", `${COOKIE}=${payload}.${sign(payload, password)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`);
    res.statusCode = 303;
    res.setHeader("Location", "/");
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("Method not allowed.");
  }
  if (!authorized(req, password)) {
    res.statusCode = pathname === "/" || pathname === "/index.html" || pathname === "/login" ? 200 : 401;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(req.method === "HEAD" ? undefined : page());
  }
  const asset = files[pathname];
  if (!asset) {
    res.statusCode = 404;
    return res.end("Not found.");
  }
  try {
    const content = await fs.readFile(path.join(process.cwd(), "site", asset[0]));
    res.setHeader("Content-Type", asset[1]);
    return res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.statusCode = 500;
    return res.end("The generator could not be loaded. Please contact the site owner.");
  }
};
