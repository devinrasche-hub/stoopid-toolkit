// Runs the exact rate-limit INSERT the Worker uses against a real sqlite
// (node:sqlite) seeded at the schema in schema.sql, so a SQL regression
// fails CI instead of production.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { RATE_LIMITED_INSERT, RATE_LIMIT_PER_HOUR } from "../src/sql.js";

const SCHEMA = readFileSync(fileURLToPath(new URL("../schema.sql", import.meta.url)), "utf8");

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

function seed(db, iph, hour, n) {
  const ins = db.prepare("INSERT INTO scores (name, score, wave, ts, iph, hour) VALUES (?,?,?,?,?,?)");
  for (let i = 0; i < n; i++) ins.run("AAA", 100 + i, 3, Date.now(), iph, hour);
}

function submit(db, iph, hour) {
  return db.prepare(RATE_LIMITED_INSERT).run("ZZZ", 999, 9, Date.now(), iph, hour);
}

test("insert succeeds below the limit (11 existing rows)", () => {
  const db = freshDb();
  seed(db, "abc", 42, RATE_LIMIT_PER_HOUR - 1);
  assert.equal(submit(db, "abc", 42).changes, 1);
});

test("insert of the 12th row succeeds, 13th is rejected", () => {
  const db = freshDb();
  seed(db, "abc", 42, RATE_LIMIT_PER_HOUR - 1); // 11 rows
  assert.equal(submit(db, "abc", 42).changes, 1); // 12th: ok
  assert.equal(submit(db, "abc", 42).changes, 0); // 13th: rate limited
});

test("insert rejected at the limit (12 existing rows)", () => {
  const db = freshDb();
  seed(db, "abc", 42, RATE_LIMIT_PER_HOUR);
  assert.equal(submit(db, "abc", 42).changes, 0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM scores").get().c, RATE_LIMIT_PER_HOUR);
});

test("limit is scoped per iph and per hour", () => {
  const db = freshDb();
  seed(db, "abc", 42, RATE_LIMIT_PER_HOUR + 1); // over the bar for abc/42
  assert.equal(submit(db, "abc", 42).changes, 0);
  assert.equal(submit(db, "other", 42).changes, 1); // different client: fine
  assert.equal(submit(db, "abc", 43).changes, 1);   // next hour: fine
});
