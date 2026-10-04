# Atlas — träningsappens grundversion

En mobilanpassad React/TypeScript-app för att hålla ett användarvalt träningsmål, planera en vecka och registrera genomförda pass. Mål ändras bara av användaren. Appen innehåller ingen AI-coach eller automatisk omplanering i den här versionen.

## Starta lokalt

Kräver Node.js 20.19+ eller 22.12+.

```bash
npm ci
npm run dev
```

Öppna adressen som Vite skriver ut. Skapa en produktionsversion med `npm run build` och kör den lokalt med `npm run preview`.
Kör `npm run typecheck` för strikt TypeScript-kontroll.

## Vad som fungerar

- Användaren kan ange konkreta styrkemål (marklyft, knäböj, bänkpress) och löpmål (5 km till maraton), nuläge och måldatum.
- Atlas räknar fram ett enkelt startförslag för antal pass från valda träningsområden och tillgängliga dagar. Användaren kan ändra antalet.
- Ett första veckoförslag kan skapas utifrån målen och redigeras pass för pass. Det är en grundstruktur, inte en individuell periodiserad plan.
- Målvärden och veckofrekvens kan ändras av användaren.
- Veckoplanens pass kan läggas till, redigeras och tas bort.
- Styrkepass kan loggas med övningar, set, repetitioner, vikt och valfri RPE per set.
- Löppass kan loggas med distans och exakt tid; snittempo räknas ut automatiskt.
- Genomförda pass registreras i en separat historik.
- Pass kan filtreras och summeras i loggen.
- Data sparas i webbläsarens lokala lagring.
- Atlas-data kan exporteras och importeras som JSON-backup.

## Arkitektur och integritet

`src/domain.ts` definierar de versionsmärkta domäntyperna. `src/data.ts` kapslar in lokal lagring bakom ett repository-gränssnitt och beskriver kontraktet för framtida hälsointegreringar. Providerdata mappas till den gemensamma `Activity`-typen. Inga behörigheter, token eller externa hälsodata ansluts i MVP:n.

Nuvarande lagring är en enda webbläsare på en och samma enhet. Den ger inte konto, molnbackup, krypterad synkning mellan enheter eller automatisk import från andra appar. Läs [datamodellen](docs/data-model.md) före val av server- och integrationslösning. Version 2 av datamodellen migrerar sparad version 1-data och behåller logg och veckoplan.
