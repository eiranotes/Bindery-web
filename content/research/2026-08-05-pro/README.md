# 2026-08-05 Pro event candidates

This directory preserves the exact research bundle produced in the Bindery WebGPT
project conversation on 2026-08-05. It is quarantined research input, not public
catalog data.

- `event-masters.candidates.jsonl`: 63 discovered event series.
- `event-editions.candidates.jsonl`: 76 candidate editions. Every record remains
  `research_candidate`.
- `source-records.candidates.jsonl`: 116 claimed official S1/S2/S3 URLs.
- `bindery-event-research-2026-08-05.md`: model report, including rejected and
  `needs_source` candidates.
- `source-reachability-audit.json`: independent live URL check. A failed fetch
  does not prove that an event is fictitious, but it blocks automatic promotion.
- `editor-review-queue.md`: reachable high-information candidates ordered for
  manual source review.

Run `npm run content:candidates:validate` after any change. Run
`npm run content:candidates:check-sources` only when a live network recheck is
intended. No file in this directory is read by the public generator.
