# Atlas datamodell v1

MVP: `src/domain.ts` är den exekverbara TypeScript-definitionen; detta dokument beskriver gränserna inför nästa steg.

## Aktuella objekt

- `TrainingGoal`: användarens mål, beskrivning och veckofrekvens. Ändras endast genom användarens uttryckliga formuläråtgärd.
- `PlannedSession`: återkommande veckostruktur. Att planera ett pass skapar inte en genomförd aktivitet.
- `Activity`: kanonisk post för något som genomförts, med tidsstämpel, träningstyp, varaktighet, ansträngning och valfri distans/anteckning.
- `AtlasData`: versionerad lokal datakapsel för backup och framtida migrering.

## Grundregler

1. AI får aldrig ändra `TrainingGoal` eller den aktiva strategin. Ändring kräver ett aktivt användarval.
2. Planerade pass och genomförda aktiviteter är olika typer och sparas separat.
3. Importerade aktiviteter får inte ändra mål eller plan.
4. Externa aktiviteter behåller källnamn och provider-id när det finns; upprepade importer ska dedupliceras på källa + provider-id.
5. Integrationsbehörigheter och åtkomsttoken lagras inte i exportfilen `AtlasData`.

## Integrationsgräns

Varje connector implementerar `HealthDataProvider` i `src/data.ts` och översätter tjänstens payload till `Activity`. Synk ska vara explicit, begränsas av datum och permission-scope, samt ha spårbar källa. Plattformsåtkomst kan kräva en native iOS/Android-app eller en backend; en vanlig webbsida kan inte själv läsa Apple Hälsa.

## Nästa datalager

Nuvarande `TrainingRepository` kan ersättas med ett API-backed repository utan att gränssnittskomponenterna behöver veta var data lagras. Innan molnsynkning införs: välj autentisering, kryptering, kontoborttagning, konflikthantering, retention och migrationspolicy. Hälsodata bör minimeras och hanteras enligt plattformens villkor och tillämpliga regler.
