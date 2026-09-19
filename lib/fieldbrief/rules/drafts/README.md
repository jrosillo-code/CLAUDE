# Research drafts — not published, not verified

The 36 country files in this folder (31 EASA baselines, five national
summaries: US, GB, JP, TH, SG) and `_authorities.json` (authority names and
links, including seven Asian authority-only entries) came from a desk review
of official sources on 2026-09-19 by an automated assistant
(`verifiedBy: "codex-source-review"`). They are **research drafts**:

- The app never loads them. `rules/index.ts` must not import from `drafts/`
  and `tests/fieldbrief-rules.test.ts` fails if any draft code is registered.
- Nothing in them has been verified by the founder. Do not attribute
  verification to anyone who has not personally read the sources.
- Their schema is the draft schema, not the verified one: `required` can be
  `null` (unknown or conditional), `maxAltitudeM` can be `null`, and they carry
  `coverage`, `scope` and `altitudeNote`.

## Promoting a draft to a published country

1. Read every statement against every URL in `sourceUrls`, plus the
   authority's current notices. Fix or delete anything you cannot confirm.
2. Copy the file to `../{cc}.json` and map the fields:
   `registrationRequired.required` → `registrationRequired.value` (a `null`
   stays `null` and renders as "depends — see note"), same for
   `pilotCertRequired` and `insuranceRequired`; `importRestriction.status` →
   `importRestriction.value`; add `countryName`; keep `scope`, `coverage` and
   `altitudeNote` if useful (they are optional in the verified schema).
3. Set `lastVerifiedOn` to the day you finished and `verifiedBy` to **your**
   handle. Register the file in `../index.ts`. Run `npm test`.

An EASA baseline draft says only what the shared EU rules say; it does not
cover national insurance, geographical zones, filming or customs rules, and
publishing one as-is would imply coverage it does not have.
