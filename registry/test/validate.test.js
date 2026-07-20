import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, validateSubmission } from "../src/validate.js";

// ---- name normalization ----

test("normalizeName uppercases and keeps alphanumerics", () => {
  assert.equal(normalizeName("stu"), "STU");
  assert.equal(normalizeName("a1z"), "A1Z");
});

test("normalizeName strips non-alphanumerics before truncating", () => {
  assert.equal(normalizeName("s.t.o.o.p.i.d"), "STO");
  assert.equal(normalizeName("!@#ab"), "AB");
  assert.equal(normalizeName("  d v  "), "DV");
});

test("normalizeName truncates to 3 chars", () => {
  assert.equal(normalizeName("DEVIN"), "DEV");
});

test("normalizeName handles missing/odd inputs", () => {
  assert.equal(normalizeName(undefined), "");
  assert.equal(normalizeName(null), "");
  assert.equal(normalizeName(""), "");
  assert.equal(normalizeName(123456), "123");
});

test("empty name after normalization is rejected as bad fields", () => {
  const r = validateSubmission({ name: "!!!", score: 100, wave: 1 });
  assert.deepEqual(r, { ok: false, error: "bad fields", status: 400 });
});

// ---- bad JSON / bad fields ----

test("null body (bad JSON) is rejected with 400 bad json", () => {
  assert.deepEqual(validateSubmission(null), { ok: false, error: "bad json", status: 400 });
});

test("non-numeric score/wave are rejected as bad fields", () => {
  for (const body of [
    { name: "STU", score: "lol", wave: 1 },
    { name: "STU", score: 100, wave: "nope" },
    { name: "STU", score: Infinity, wave: 1 },
    { name: "STU" },
  ]) {
    const r = validateSubmission(body);
    assert.deepEqual(r, { ok: false, error: "bad fields", status: 400 }, JSON.stringify(body));
  }
});

test("numeric strings are coerced and floored", () => {
  const r = validateSubmission({ name: "stu", score: "1234.9", wave: "2.7" });
  assert.deepEqual(r, { ok: true, name: "STU", score: 1234, wave: 2 });
});

// ---- plausibility gates ----

test("negative score is doubted", () => {
  const r = validateSubmission({ name: "STU", score: -1, wave: 1 });
  assert.deepEqual(r, { ok: false, error: "the registry doubts you", status: 422 });
});

test("wave must be between 1 and 99", () => {
  assert.equal(validateSubmission({ name: "STU", score: 100, wave: 0 }).status, 422);
  assert.equal(validateSubmission({ name: "STU", score: 100, wave: 100 }).status, 422);
  assert.equal(validateSubmission({ name: "STU", score: 100, wave: 1 }).ok, true);
  assert.equal(validateSubmission({ name: "STU", score: 100, wave: 99 }).ok, true);
});

test("absolute score cap is 250000", () => {
  assert.equal(validateSubmission({ name: "STU", score: 250001, wave: 99 }).status, 422);
  assert.equal(validateSubmission({ name: "STU", score: 250000, wave: 99 }).ok, true);
});

test("score cannot exceed wave * 3000 + 5000", () => {
  // wave 2 → cap 11000
  assert.equal(validateSubmission({ name: "STU", score: 11001, wave: 2 }).status, 422);
  assert.deepEqual(
    validateSubmission({ name: "STU", score: 11000, wave: 2 }),
    { ok: true, name: "STU", score: 11000, wave: 2 }
  );
});

test("valid submission passes through normalized", () => {
  const r = validateSubmission({ name: "dev!", score: 4200, wave: 3 });
  assert.deepEqual(r, { ok: true, name: "DEV", score: 4200, wave: 3 });
});
