const db = new Promise((resolve, reject) => {
  const open = indexedDB.open("arrival-slip-book", 1);
  open.onupgradeneeded = () => {
    const store = open.result.createObjectStore("slips", { keyPath: "id" });
    store.createIndex("filed", "filed");
    open.result.createObjectStore("settings");
  };
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});
async function transaction(name, mode, work) {
  const conn = await db;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(name, mode);
    const request = work(tx.objectStore(name), tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ||
          Error("The book changed in another tab. Reload to continue."),
      );
  });
}
export const listSlips = () =>
  transaction("slips", "readonly", (s) => s.getAll()).then((rows) =>
    rows.sort((a, b) => b.filed.localeCompare(a.filed)),
  );
export const setting = (key) =>
  transaction("settings", "readonly", (s) => s.get(key));
export const setSetting = (key, value) =>
  transaction("settings", "readwrite", (s) => s.put(value, key));
export const saveSlip = (record, studio) =>
  transaction("slips", "readwrite", (store, tx) => {
    const count = store.count();
    count.onsuccess = () => {
      if (!studio && count.result >= 1) tx.abort();
      else store.add(record);
    };
  });
export const mergeSlips = (rows) =>
  transaction("slips", "readwrite", (store) => {
    for (const row of rows) {
      const existing = store.get(row.id);
      existing.onsuccess = () => {
        if (!existing.result) store.put(row);
      };
    }
  });
