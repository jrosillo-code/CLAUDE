# Field Brief country rules

One JSON file per country, named by ISO 3166-1 alpha-2 code in lower case
(`pt.json`, `jp.json`), bundled offline like `lib/landmarks.ts`. The files are
the only source of legality statements in Waypoint: the model never writes a
rule, and a country without a file renders as "not yet covered".

## The rule about rules

**A rule without a source and a date is not a rule.** Every file carries
`sourceUrls[]` (at least one), `lastVerifiedOn` (ISO date) and `verifiedBy`
(the handle of the person who checked it). The UI never says "legal" or
"allowed" — it says "as of {date}, per {source}". A file older than 180 days
renders with a stale warning; older than 365 days fails the test suite.

Waypoint never claims airspace authority: no LAANC, no UTM, no geofence
checks. Point `nationalApp` at the country's own tool and the page links to it.

## Adding a country

1. Copy `_template.json` to `{cc}.json` (lower-case code). Every `example.invalid` URL in it is a placeholder that must be replaced with the real page.
2. Fill every field from primary sources you have read yourself — the
   authority's site, the regulation text, the official app. Do not paste a
   summary from a forum or a model.
3. Set `lastVerifiedOn` to today and `verifiedBy` to your handle.
4. Register the file in `index.ts` (one import line, one map entry).
5. Run `npm test` — `tests/fieldbrief-rules.test.ts` checks the schema, the
   sources, the date, and that the code matches the filename.

## Fields

| Field | Meaning |
|---|---|
| `countryCode`, `countryName` | ISO alpha-2 (upper case in the file) and the display name |
| `regime` | `easa` (EU/EEA harmonised rules) or `national` |
| `authorityName`, `authorityUrl` | the civil aviation authority and its drone page |
| `registrationRequired`, `pilotCertRequired`, `insuranceRequired` | `{ value: boolean, note }` — the note says for whom and above what weight |
| `weightClasses[]` | `{ maxGrams, summary }` from lightest to heaviest |
| `maxAltitudeM` | the general ceiling in metres above ground |
| `maxDistanceRule` | the distance / line-of-sight wording |
| `importRestriction` | `{ value: "none" \| "declare" \| "banned" \| "unknown", note }` |
| `noFlyHighlights[]` | short strings: the places people most often ask about |
| `permitProcess` | `{ who, how, leadTimeDays, url }` or `null` when no permit path exists |
| `nationalApp` | `{ name, url }` or `null` |
| `sourceUrls[]`, `lastVerifiedOn`, `verifiedBy`, `notes` | provenance |
