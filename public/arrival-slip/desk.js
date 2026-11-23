import {
  blankSlip,
  cleanUrl,
  dateText,
  escapeHTML as esc,
  receipt,
  validClip,
  validate,
  verdict,
} from "./record.js";
import { listSlips, saveSlip, setting, setSetting } from "./storage.js";
import { count, post, source } from "./common.js";
const $ = (id) => document.getElementById(id);
const fields = {
  client: "client",
  formUrl: "form-url",
  destination: "destination",
  pageResult: "page-result",
  deliveryResult: "delivery-result",
  pageNote: "page-note",
  deliveryNote: "delivery-note",
  next: "next",
};
let draft,
  records = [],
  studio,
  premium,
  writing = false,
  filing = false;
const say = (m) => {
  $("notice").textContent = m;
};
function announce() {
  document.dispatchEvent(
    new CustomEvent("arrival-slip-arm", {
      detail: writing && draft ? draft.reference : "",
    }),
  );
}
document.addEventListener("arrival-slip-ready", announce);
window.addEventListener("focus", announce);
async function persist() {
  if (draft && writing)
    await setSetting("draft:" + draft.id, structuredClone(draft));
}
function showClip(side) {
  const el = $(side + "-clip");
  el.replaceChildren();
  if (!draft[side + "Source"]) return;
  const small = document.createElement("small");
  small.textContent =
    "Chrome clip · " +
    draft[side + "Source"] +
    " · " +
    dateText(draft[side + "At"]);
  el.append(small);
  if (validClip(draft[side + "Image"])) {
    const img = document.createElement("img");
    img.alt = "Selected evidence crop";
    img.src = draft[side + "Image"];
    el.append(img);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet";
    remove.textContent = "Remove image";
    remove.onclick = () => {
      delete draft[side + "Image"];
      showClip(side);
      void persist().catch((e) => say(e.message));
    };
    el.append(remove);
  }
}
document.addEventListener("arrival-slip-evidence", (e) => {
  const v = e.detail,
    side = v?.side;
  if (
    !writing ||
    !draft ||
    v.reference !== draft.reference ||
    !["page", "delivery"].includes(side) ||
    typeof v.text !== "string" ||
    !v.text.trim()
  )
    return;
  draft[side + "Note"] = v.text.trim().slice(0, 1000);
  $(fields[side + "Note"]).value = draft[side + "Note"];
  draft[side + "Source"] = String(v.host || "").slice(0, 180);
  draft[side + "At"] = new Date().toISOString();
  delete draft[side + "Image"];
  if (validClip(v.image)) draft[side + "Image"] = v.image;
  showClip(side);
  say("Clip added. Review the excerpt and choose the result you observed.");
  void persist().catch((e) => say(e.message));
  document.dispatchEvent(
    new CustomEvent("arrival-slip-accepted", { detail: draft.reference }),
  );
});
function renderDraft(s) {
  draft = s;
  writing = true;
  $("view").replaceChildren();
  $("slip-form").hidden = false;
  for (const [key, id] of Object.entries(fields)) $(id).value = s[key] || "";
  $("reference").textContent = s.reference;
  $("serial").textContent = "Operator original";
  ["page", "delivery"].forEach(showClip);
  announce();
}
async function create(previous) {
  if (
    writing &&
    draft &&
    Object.values(fields).some((id) => $(id).value.trim()) &&
    !confirm("Start a new check and replace this unfinished draft?")
  )
    return;
  if (records.length && !(await accessNow())) {
    openAccess();
    return;
  }
  say("");
  const s = blankSlip(previous);
  await setSetting("lastDraft", s.id);
  sessionStorage.setItem("arrival-draft", s.id);
  renderDraft(s);
  await persist();
  $("client").focus();
}
function renderReceipt(s) {
  writing = false;
  announce();
  $("slip-form").hidden = true;
  $("view").innerHTML =
    receipt(s, premium?.agencyName || "") +
    '<div class="actions"><button class="button" id="print-slip">Print / save PDF</button><button class="quiet" id="repeat-slip">Repeat this check</button></div>';
  $("print-slip").onclick = () => {
    count("print");
    print();
  };
  $("repeat-slip").onclick = () => void create(s).catch((e) => say(e.message));
}
function showHistory() {
  $("history").replaceChildren();
  if (records.length) {
    const h = document.createElement("h3");
    h.className = "shelf-group";
    h.textContent = "Filed receipts";
    $("history").append(h);
  }
  for (const row of records) {
    const b = document.createElement("button");
    b.className = "history-entry";
    b.innerHTML =
      "<strong>" +
      esc(row.client) +
      "</strong><small>" +
      esc(row.filed.slice(0, 10)) +
      " · " +
      esc(verdict(row)) +
      "</small>";
    b.onclick = () => {
      say("");
      renderReceipt(row);
    };
    $("history").append(b);
  }
}
async function accessNow() {
  const response = await fetch("api/access", { cache: "no-store" });
  if (!response.ok)
    throw Error(
      "Studio access could not be checked. Your local book is still here.",
    );
  const data = await response.json();
  studio = data.studio === true;
  $("edition").textContent = studio
    ? "Studio · one operator"
    : "Single receipt";
  $("unlock").textContent = studio ? "Manage access" : "Unlock Studio";
  if (studio && !premium) {
    const { setup } = await import("./api/studio.js");
    premium = await setup({
      listSlips,
      setting,
      setSetting,
      renderReceipt,
      create,
      accessNow,
      say,
      showReport: (html) => {
        writing = false;
        announce();
        $("slip-form").hidden = true;
        $("view").innerHTML = html;
      },
      refresh: async () => {
        records = await listSlips();
        showHistory();
        await premium?.refresh();
      },
    });
  }
  if (!studio && premium) {
    premium = null;
    $("studio-tools").replaceChildren();
  }
  return studio;
}
function openAccess() {
  $("access").showModal();
  $("key").focus();
}
$("unlock").onclick = () => {
  if (studio) location.href = "support";
  else openAccess();
};
$("key-form").onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  $("key-status").textContent = "Checking your key…";
  try {
    await post("activate", { key: $("key").value.trim(), source: source() });
    $("key").value = "";
    await accessNow();
    $("access").close();
    $("key-status").textContent = "";
    say("Studio is active. Your previous receipts are in the book.");
  } catch (err) {
    $("key-status").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
};
$("new").onclick = () => void create().catch((e) => say(e.message));
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(draft.reference);
    say("Reference copied. Include it in your test inquiry.");
  } catch {
    say("Select and copy the reference shown above.");
  }
};
$("slip-form").addEventListener("input", (e) => {
  if (!writing || !draft) return;
  const key = Object.keys(fields).find((k) => fields[k] === e.target.id);
  if (!key) return;
  draft[key] = e.target.value;
  for (const side of ["page", "delivery"]) {
    if (key === side + "Note" || key === side + "Result") {
      if (key === side + "Note") {
        delete draft[side + "Source"];
        delete draft[side + "Image"];
        showClip(side);
      }
      if (!draft[side + "Source"])
        draft[side + "At"] = new Date().toISOString();
    }
  }
  void persist().catch(() =>
    say(
      "Draft storage failed. Check available browser storage before leaving this page.",
    ),
  );
});
$("slip-form").onsubmit = async (e) => {
  e.preventDefault();
  if (filing) return;
  const error = validate(draft);
  if (error) {
    say(error);
    return;
  }
  filing = true;
  e.submitter.disabled = true;
  try {
    const paid = records.length || studio ? await accessNow() : false;
    if (records.length && !paid) {
      openAccess();
      return;
    }
    const row = {
      ...draft,
      client: draft.client.trim(),
      formUrl: cleanUrl(draft.formUrl.trim()),
      filed: new Date().toISOString(),
    };
    await saveSlip(row, paid);
    writing = false;
    await setSetting("draft:" + draft.id, null);
    records = await listSlips();
    showHistory();
    await premium?.refresh();
    renderReceipt(row);
    say("Receipt filed on this device.");
    count("filed");
  } catch (err) {
    say(err.message || "The receipt could not be saved.");
  } finally {
    filing = false;
    e.submitter.disabled = false;
  }
};
async function start() {
  records = await listSlips();
  showHistory();
  try {
    await accessNow();
  } catch (err) {
    say(err.message);
  }
  const id =
    sessionStorage.getItem("arrival-draft") || (await setting("lastDraft"));
  const pending = id && (await setting("draft:" + id));
  if (pending && !records.some((r) => r.id === pending.id))
    renderDraft(pending);
  else if (records.length) renderReceipt(records[0]);
  else await create();
  if (new URLSearchParams(location.search).get("unlock") === "1" && !studio)
    openAccess();
  count("desk");
}
start().catch((err) =>
  say("The local receipt book could not open. " + err.message),
);
