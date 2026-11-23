import {
  dueDate,
  escapeHTML as e,
  receipt,
  validClip,
  validate,
  verdict,
} from "/arrival-slip/record.js";
import { mergeSlips } from "/arrival-slip/storage.js";
import { count } from "/arrival-slip/common.js";
const $ = (id) => document.getElementById(id);
function targetKey(row) {
  return JSON.stringify([
    row.client.toLowerCase().trim(),
    row.formUrl,
    row.destination.toLowerCase().trim(),
  ]);
}
function backupRow(row) {
  if (
    !row ||
    !/^[a-f0-9-]{36}$/i.test(row.id) ||
    !/^AS-[A-F0-9]{10}$/.test(row.reference) ||
    !isFinite(Date.parse(row.filed)) ||
    !isFinite(Date.parse(row.created))
  )
    throw Error("The backup contains an invalid receipt.");
  const out = {};
  for (const [k, limit] of Object.entries({
    id: 36,
    reference: 13,
    client: 90,
    formUrl: 450,
    destination: 100,
    pageResult: 24,
    deliveryResult: 24,
    pageNote: 1000,
    deliveryNote: 1000,
    next: 240,
    created: 35,
    filed: 35,
  })) {
    if (typeof row[k] !== "string" || row[k].length > limit)
      throw Error("The backup contains an invalid field.");
    out[k] = row[k];
  }
  for (const side of ["page", "delivery"]) {
    if (row[side + "Source"])
      out[side + "Source"] = String(row[side + "Source"]).slice(0, 180);
    if (isFinite(Date.parse(row[side + "At"])))
      out[side + "At"] = new Date(row[side + "At"]).toISOString();
    if (validClip(row[side + "Image"]))
      out[side + "Image"] = row[side + "Image"];
  }
  const error = validate(out);
  if (error) throw Error(error);
  return out;
}
export async function setup(api) {
  let agencyName = (await api.setting("agency")) || "";
  const host = $("studio-tools");
  host.innerHTML =
    '<h3 class="shelf-group">Next monthly checks</h3><div id="due-list"></div><details open><summary>Monthly report</summary><label>Agency name<input id="agency" maxlength="100" placeholder="Your studio"></label><label>Client<select id="report-client"></select></label><label>Reporting month<input type="month" id="report-month"></label><button class="outline small" id="make-report">Prepare report</button></details><details><summary>Book backup</summary><div class="studio-buttons"><button class="quiet" id="backup">Download backup</button><label>Restore backup<input type="file" accept=".json,application/json" id="restore"></label></div></details>';
  $("agency").value = agencyName;
  $("report-month").value = new Date().toISOString().slice(0, 7);
  $("agency").onchange = async () => {
    agencyName = $("agency").value.trim();
    await api.setSetting("agency", agencyName);
  };
  async function refresh() {
    const rows = await api.listSlips(),
      prior = $("report-client").value;
    const clients = [...new Set(rows.map((r) => r.client))].sort();
    $("report-client").replaceChildren(...clients.map((c) => new Option(c, c)));
    if (clients.includes(prior)) $("report-client").value = prior;
    const newest = new Map();
    for (const s of rows)
      if (!newest.has(targetKey(s))) newest.set(targetKey(s), s);
    $("due-list").replaceChildren();
    for (const s of [...newest.values()].sort((a, b) =>
      a.filed.localeCompare(b.filed),
    )) {
      const b = document.createElement("button");
      b.className = "repeat";
      b.innerHTML =
        e(s.client) +
        "<small>" +
        e(s.destination) +
        " · Due " +
        e(dueDate(s.filed)) +
        "</small>";
      b.onclick = () => void api.create(s).catch((err) => api.say(err.message));
      $("due-list").append(b);
    }
    if (!rows.length)
      $("due-list").textContent = "File a receipt to schedule its next check.";
  }
  function guarded(fn) {
    return async () => {
      try {
        if (!(await api.accessNow()))
          throw Error("Activate Studio to use this feature.");
        await fn();
      } catch (err) {
        api.say(err.message);
      }
    };
  }
  $("make-report").onclick = guarded(async () => {
    const month = $("report-month").value,
      client = $("report-client").value;
    const rows = (await api.listSlips()).filter(
      (s) => s.client === client && s.filed.slice(0, 7) === month,
    );
    if (!rows.length)
      throw Error("No receipts for this client in the selected month.");
    const arrived = rows.filter((s) => verdict(s) === "Arrived").length;
    api.showReport(
      '<div class="report-title"><p class="eyebrow">' +
        e(agencyName || "Arrival Slip Studio") +
        "</p><h2>" +
        e(client) +
        " · " +
        e(month) +
        "</h2><p>" +
        rows.length +
        " checks filed. " +
        arrived +
        " arrived with page confirmation. " +
        (rows.length - arrived) +
        " require review.</p></div>" +
        rows.map((s) => receipt(s, agencyName)).join("") +
        '<div class="actions"><button class="button" id="print-report">Print / save monthly PDF</button></div>',
    );
    $("print-report").onclick = () => {
      count("report");
      print();
    };
  });
  $("backup").onclick = guarded(async () => {
    const rows = await api.listSlips();
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            format: "arrival-slip-1",
            agency: agencyName,
            receipts: rows,
          }),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "arrival-slip-book-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("restore").onchange = guarded(async () => {
    const input = $("restore");
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    if (file.size > 64 * 1024 * 1024)
      throw Error("Use a backup smaller than 64 MB.");
    const data = JSON.parse(await file.text());
    if (data.format !== "arrival-slip-1" || !Array.isArray(data.receipts))
      throw Error("Choose an Arrival Slip backup.");
    const rows = data.receipts.map(backupRow);
    await mergeSlips(rows);
    if (!agencyName && typeof data.agency === "string") {
      agencyName = data.agency.slice(0, 100);
      $("agency").value = agencyName;
      await api.setSetting("agency", agencyName);
    }
    await api.refresh();
    api.say("Backup merged. Existing receipts were preserved.");
  });
  await refresh();
  return {
    refresh,
    get agencyName() {
      return agencyName;
    },
  };
}
