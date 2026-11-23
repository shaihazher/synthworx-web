const scope = "/arrival-slip/";
const valid = [
  "agency-email",
  "editorial",
  "directory",
  "search",
  "referral",
  "qa",
  "direct",
];
const incoming = new URLSearchParams(location.search).get("src");
try {
  if (valid.includes(incoming))
    sessionStorage.setItem("arrival-source", incoming);
} catch {}
export function source() {
  try {
    return sessionStorage.getItem("arrival-source") || "direct";
  } catch {
    return "direct";
  }
}
export async function post(part, data = {}) {
  const res = await fetch(scope + "api/" + part, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok)
    throw Error(result.message || "The request could not be completed.");
  return result;
}
export function count(event) {
  void post("event", { event, source: source() }).catch(() => {});
}
for (const a of document.querySelectorAll("[data-buy]"))
  a.href = scope + "buy?src=" + encodeURIComponent(source());
if (location.pathname === scope) count("page");
if (location.pathname === scope + "sample") count("sample");
