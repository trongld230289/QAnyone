import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTotp } from "../QAnyone/templates/totp";

// RFC 6238 vector: secret "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ),
// T = 59 s → SHA-1 8-digit 94287082 → 6-digit 287082.
test("rfc6238 vector", () => {
  assert.equal(generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000), "287082");
});

test("normalizes spaces and lowercase in the secret", () => {
  assert.equal(generateTotp("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000), "287082");
});
