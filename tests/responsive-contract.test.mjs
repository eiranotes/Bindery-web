import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("wide detail content stays inside its own responsive scroll boundary", () => {
  assert.match(
    css,
    /\.detail-body-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0;/s,
  );
  assert.match(
    css,
    /\.table-scroll\s*\{[^}]*overflow-x:\s*auto;/s,
  );
});

test("D-day plate motion aligns on focus and respects reduced motion", () => {
  assert.match(
    css,
    /li:focus-within\s+\.d-day__offset\s*\{[^}]*transform:\s*translate\(0\);/s,
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.d-day__offset\s*\{[^}]*transform:\s*translate\(0\);[^}]*transition:\s*none;/s,
  );
});
