# Football Score

Mobilvennlig webapp for lagadministrasjon, kampoversikt og live kampregistrering.

## Teknologi

- React + Vite
- TypeScript
- Sass
- Material UI
- Firebase Authentication
- Firebase Realtime Database

## Kom i gang

1. Installer avhengigheter:

```bash
npm install
```

2. Opprett en lokal `.env` basert på `.env.example`.

3. Fyll inn Firebase-variablene:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

4. Start utviklingsserveren:

```bash
npm run dev
```

## Funksjoner som er implementert

- Google-innlogging via Firebase Authentication
- Førstegangsregistrering med navn på forelder og barn
- Godkjenningsflyt der nye brukere må godkjennes av admin
- Rollebasert tilgang for `FORELDER`, `ADMIN` og `KAMPLEDER`
- Adminside for opprettelse av lag og tildeling av roller/lag
- Lagside med manuell kampopprettelse
- Import av kamper fra `fotball.no` i kalenderformat
- Kampside med klokke, pause, 2. omgang, målregistrering og hendelseslogg

## Viktige notater

- Firebase-konfigurasjon i en frontend-app er ikke en hemmelighet i seg selv. Beskytt dataene med Firebase-regler.
- `fotball.no`-importen er implementert i klienten. Hvis nettleseren blokkerer kallene med CORS, må importen flyttes til en proxy eller serverless-funksjon.
