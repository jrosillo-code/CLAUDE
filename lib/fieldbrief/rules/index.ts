import type { CountryRules } from "../rules";

// The registry of curated country files. Adding a country is one import and
// one entry; tests/fieldbrief-rules.test.ts fails if a JSON file exists in
// this folder without being registered here, or the other way round.
//
// Deliberately empty at launch: the founder supplies the first ten countries
// from waters he has flown in himself, with the sources. Nothing here is
// invented to fill the map.
export const RULE_FILES: Record<string, CountryRules> = {};
