import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("signed-in inactive accounts do not receive account or privileged mutation surfaces", async () => {
  const [binder, verification, invitation, audit, artistList, artistDetail] =
    await Promise.all([
      source("../app/me/page.tsx"),
      source("../app/community/verify/page.tsx"),
      source("../app/community/invite/[token]/page.tsx"),
      source("../app/admin/community/audit/page.tsx"),
      source("../app/community/artists/page.tsx"),
      source("../app/community/artists/[slug]/page.tsx"),
    ]);

  assert.match(binder, /canUseAccountBinder[\s\S]*general:bookmark/);
  assert.match(binder, /syncState=\{[\s\S]*canUseAccountBinder/);
  assert.match(verification, /canApply[\s\S]*accountStatus\s*===\s*"active"/);
  assert.match(verification, /canApply\s*&&\s*artistStatus\s*===\s*"none"/);
  assert.match(invitation, /accountStatus\s*===\s*"active"/);
  assert.match(audit, /capabilities\.includes\("admin:roles"\)/);
  assert.match(artistList, /canWriteArtist\s*\?/);
  assert.match(artistDetail, /capabilities\.includes\("artist:write"\)\s*\?/);
});
