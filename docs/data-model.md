# Atlas datamodell v2

`src/domain.ts` är den exekverbara TypeScript-definitionen. Version 2 lägger till mätbara mål och träningsramar och migrerar den lokalt sparade version 1-datan.

## Aktuella objekt

- `TrainingGoal`: användarens mål, tillgängliga träningsdagar, eget valt antal pass och Atlas grova frekvensförslag.
- `PerformanceTarget`: antingen ett styrkelyft med valfritt nuläge och målvikt, eller en löpdistans med valfritt nuläge och måltid. Måldatum är valfritt.
- `PlannedSession`: återkommande veckostruktur med typ, dag, längd, fokus och valfri distans. Att planera ett pass skapar inte en genomförd aktivitet.
- `Activity`: kanonisk post för något som genomförts, med tidsstämpel, träningstyp, varaktighet, ansträngning och valfri distans/anteckning.
- `AtlasData`: versionsmärkt lokal datakapsel för backup och migrering.

Frekvensförslaget är i nuläget en enkel regel: 3 pass för antingen styrka eller löpning, 4 för båda, begränsat av valda dagar. Det är inte ett individuellt träningsråd. För en mer välgrundad periodisering behöver appen bland annat nuläge, träningsvana, återhämtning och måldatum.

## Grundregler

1. Träningsmål ändras endast genom användarens uttryckliga val.
2. Planerade pass och genomförda aktiviteter är olika typer och sparas separat.
3. Importerade aktiviteter får inte ändra mål eller plan.
4. Externa aktiviteter behåller källnamn och provider-id när det finns; upprepade importer ska dedupliceras på källa + provider-id.
5. Integrationsbehörigheter och åtkomsttoken lagras inte i exportfilen `AtlasData`.
6. Migration från v1 bevarar befintlig plan och träningslogg. Äldre allmänna mål migreras som tomma mätbara mål, så användaren får ange sina nya målvärden själv.

## Integrationsgräns

Varje connector implementerar `HealthDataProvider` i `src/data.ts` och översätter tjänstens payload till `Activity`. Synk ska vara explicit, begränsas av datum och permission-scope, samt ha spårbar källa. Plattformsåtkomst kan kräva en native iOS/Android-app eller en backend; en vanlig webbsida kan inte själv läsa Apple Hälsa.

## Nästa datalager

Nuvarande `TrainingRepository` kan ersättas med ett API-backed repository utan att gränssnittskomponenterna behöver veta var data lagras. Innan molnsynkning införs: välj autentisering, kryptering, kontoborttagning, konflikthantering, retention och migrationspolicy. Hälsodata bör minimeras och hanteras enligt plattformens villkor och tillämpliga regler.
