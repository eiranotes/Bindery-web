import assert from "node:assert/strict";
import test from "node:test";

import { siteUrlFromHeaders } from "../app/lib/site-origin.ts";

test("derives public URLs from the incoming request origin", () => {
  const production = siteUrlFromHeaders(
    new Headers({
      "x-forwarded-host": "bindery.example.org",
      "x-forwarded-proto": "https",
    }),
  );
  assert.equal(production.toString(), "https://bindery.example.org/");

  const local = siteUrlFromHeaders(
    new Headers({
      host: "localhost:3000",
    }),
  );
  assert.equal(local.toString(), "http://localhost:3000/");
});
