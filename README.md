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

- Mål och veckofrekvens kan ändras av användaren.
- Veckoplanens pass kan läggas till, redigeras och tas bort.
- Genomförda pass registreras i en separat historik.
- Pass kan filtreras och summeras i loggen.
- Data sparas i webbläsarens lokala lagring.
- Atlas-data kan exporteras och importeras som JSON-backup.

## Arkitektur och integritet

`src/domain.ts` definierar de versionsmärkta domäntyperna. `src/data.ts` kapslar in lokal lagring bakom ett repository-gränssnitt och beskriver kontraktet för framtida hälsointegreringar. Providerdata mappas till den gemensamma `Activity`-typen. Inga behörigheter, token eller externa hälsodata ansluts i MVP:n.

Nuvarande lagring är en enda webbläsare på en och samma enhet. Den ger inte konto, molnbackup, krypterad synkning mellan enheter eller automatisk import från andra appar. Läs [datamodellen](docs/data-model.md) före val av server- och integrationslösning.
