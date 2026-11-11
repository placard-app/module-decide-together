# Decide Together

Choose a place with your household. An organizer selects two to fifty household-shared places and opens a poll. Each signed-in member chooses one favorite and can change their vote until the organizer reveals. Joint favorites share first place.

Install using `https://github.com/placard-app/module-decide-together`, or upload the built `.placard-module` in Placard’s module marketplace. Requires SDK 1, persistent-data, and household mode. Static host navigation may show the entry in solo mode, where the page explains the requirement.

Place cards show saved photos, categories and opening hours. Cards without photos use a compact text layout. View place opens the shared place details in a new tab during shortlisting, voting, and results. Private and deleted places become unavailable, and their votes are excluded before reveal. Members can choose again. Revealed counts remain fixed, while place details continue to follow the viewer’s access.

Only the organizer can reveal, after at least one eligible ballot. Voting closes permanently at reveal. Open polls refresh every five seconds. Revisit polls from the module page after a reload.

## Data and endpoints

The host supplies the signed-in account and household setting. All household members can view the instance’s polls. Individual ballots stay private, with each member receiving only their own selection. Final results expose aggregate counts.

Data lives in `decide-together.sqlite` in the host’s durable module data directory. Back up this file with Placard’s module data. Votes and reveals use SQLite transactions.

Module HTTP routes under `/api/m/places.decide-together` are GET `/places`, GET/POST `/polls`, GET `/polls/:id`, POST `/polls/:id/vote` with `{placeId}`, and POST `/polls/:id/reveal`. Creating a poll accepts `{title, placeIds}` and immediately opens voting.

## Development

Run `pnpm install` at the repository root. Use `pnpm typecheck`, `test`, `build`, or `test:e2e`. Browser tests require Docker and the sibling Placard checkout with built web assets. Set PLACARD_CORE_DIR to override its location.

The build produces versioned zip and .placard-module archives in dist.

## Standalone releases

Install from https://github.com/placard-app/module-decide-together. Merge the manifest and package version change through a pull request. Tag the merged commit as `places.decide-together@<version>` to publish both archives.
