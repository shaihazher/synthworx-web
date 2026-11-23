import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync } from "node:fs";
const file = join(
  process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data",
  "arrival-slip",
  "business.sqlite",
);
if (!existsSync(file)) {
  console.log("[]");
} else {
  const db = new DatabaseSync(file, { readOnly: true });
  console.log(
    JSON.stringify(
      db
        .prepare(
          "SELECT day,source,event,n FROM counters WHERE source<>'qa' AND day>=date('now','-30 days') ORDER BY day,source,event",
        )
        .all(),
    ),
  );
  db.close();
}
