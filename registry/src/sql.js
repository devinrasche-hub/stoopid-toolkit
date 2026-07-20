// SQL shared between the Worker and the test suite, so the exact
// concurrency-critical statement is what gets exercised in CI.

// atomic rate limit: the count check and the insert happen in one statement,
// so parallel submits can't all slip under the 12/hour bar
export const RATE_LIMIT_PER_HOUR = 12;
export const RATE_LIMITED_INSERT =
  "INSERT INTO scores (name, score, wave, ts, iph, hour) " +
  "SELECT ?1, ?2, ?3, ?4, ?5, ?6 " +
  "WHERE (SELECT COUNT(*) FROM scores WHERE iph=?5 AND hour=?6) < " + RATE_LIMIT_PER_HOUR;
