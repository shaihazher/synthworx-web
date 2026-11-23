export const pageLabels = {
  confirmed: "Confirmation observed",
  failed: "Form failed",
  unknown: "Page unverified",
};
export const deliveryLabels = {
  matched: "Matching entry seen",
  missing: "No matching entry found",
  unavailable: "Destination unverified",
};
export function blankSlip(previous = {}) {
  return {
    id: crypto.randomUUID(),
    reference:
      "AS-" +
      crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase(),
    client: previous.client || "",
    formUrl: previous.formUrl || "",
    destination: previous.destination || "",
    pageResult: "",
    deliveryResult: "",
    pageNote: "",
    deliveryNote: "",
    next: "",
    created: new Date().toISOString(),
  };
}
export function cleanUrl(raw) {
  try {
    const u = new URL(/^[a-z]+:/i.test(raw) ? raw : "https://" + raw);
    if (
      !["https:", "http:"].includes(u.protocol) ||
      !u.hostname.includes(".") ||
      u.username ||
      u.password
    )
      return "";
    return u.origin + u.pathname;
  } catch {
    return "";
  }
}
export function hasReference(text, reference) {
  return (
    /^AS-[A-F0-9]{10}$/.test(reference) &&
    new RegExp(
      "(^|[^A-Za-z0-9-])" + reference + "(?=$|[^A-Za-z0-9-])",
      "i",
    ).test(text)
  );
}
export function validate(s) {
  if (!s.client?.trim() || !cleanUrl(s.formUrl))
    return "Enter the client and a valid web address for the form.";
  if (!Object.hasOwn(pageLabels, s.pageResult) || !s.pageNote?.trim())
    return "Record the page result and what you observed.";
  if (
    !s.destination?.trim() ||
    !Object.hasOwn(deliveryLabels, s.deliveryResult) ||
    !s.deliveryNote?.trim()
  )
    return "Name the destination, its result and your observation.";
  if (
    s.deliveryResult === "matched" &&
    !hasReference(s.deliveryNote, s.reference)
  )
    return "The destination excerpt must contain this slip’s exact test reference.";
  return "";
}
export function verdict(s) {
  if (s.pageResult === "failed" && s.deliveryResult === "matched")
    return "Arrived with form error";
  if (s.pageResult === "failed") return "Form failed";
  if (s.deliveryResult === "missing") return "Missing";
  if (
    s.deliveryResult === "matched" &&
    hasReference(s.deliveryNote, s.reference)
  )
    return s.pageResult === "confirmed"
      ? "Arrived"
      : "Arrived · page unverified";
  return "Unverified";
}
export function dueDate(filed) {
  const date = new Date(filed);
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      Math.min(date.getUTCDate(), end),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function escapeHTML(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function validClip(image) {
  return (
    typeof image === "string" &&
    image.length < 360000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)
  );
}
export const dateText = (value) =>
  new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
function proof(s, side, label, detail) {
  const e = escapeHTML,
    source = s[side + "Source"],
    image = s[side + "Image"],
    at = s[side + "At"];
  return (
    "<section><h3>" +
    label +
    "</h3><strong>" +
    e(detail) +
    "</strong><p>" +
    e(s[side + "Note"]) +
    "</p>" +
    (validClip(image)
      ? '<img class="evidence-img" alt="Operator-selected evidence crop" src="' +
        image +
        '">'
      : "") +
    "<small>" +
    e(source ? "Chrome clip · " + source : "Operator entry") +
    (at ? " · " + e(dateText(at)) : "") +
    "</small></section>"
  );
}
export function receipt(s, agency = "", sample = false) {
  const e = escapeHTML,
    status = verdict(s);
  return (
    '<article class="receipt"><div class="receipt-header"><div><p class="eyebrow">' +
    e(
      sample
        ? "Sample delivery receipt"
        : agency || "Arrival Slip · Delivery receipt",
    ) +
    '</p><span class="serial">' +
    e(s.reference) +
    '</span></div><span class="stamp' +
    (status === "Arrived" ? "" : " issue") +
    '">' +
    e(status) +
    "</span></div><h2>" +
    e(s.client) +
    "</h2><dl><dt>Form</dt><dd>" +
    e(s.formUrl) +
    "</dd><dt>Destination</dt><dd>" +
    e(s.destination) +
    "</dd><dt>Filed</dt><dd>" +
    e(dateText(s.filed)) +
    '</dd></dl><div class="proofs">' +
    proof(s, "page", "Page response", pageLabels[s.pageResult]) +
    proof(
      s,
      "delivery",
      "Destination check",
      deliveryLabels[s.deliveryResult],
    ) +
    "</div>" +
    (s.next ? "<p><strong>Next action</strong><br>" + e(s.next) + "</p>" : "") +
    '<p class="meta">Point-in-time check recorded by the operator' +
    (sample ? " · Fictional example" : "") +
    ".</p></article>"
  );
}
