Projet Huma - Backend

API Express pour Huma.

## Demarrage rapide
```bash
npm install
npm run dev
```

## Commandes
```bash
# dev (nodemon)
npm run dev

# prod
npm start

# tests (placeholder)
npm test
```

## API
Base URL (Render): `https://huma-backend-a0wj.onrender.com`

### Checkins - Résumés
- `GET /checkins/weekly-summary`
- `GET /checkins/weekly-factors`

Paramètres (optionnels) :
- `period`: `week` | `month` | `year` (défaut: `week`)
- `date`: `YYYY-MM-DD` (week) / `YYYY-MM` (month) / `YYYY` (year)
- `weekStart`: `YYYY-MM-DD` (utilisé si `period=week`)

## Docs API (Swagger)
- Local: `http://localhost:3000/api-docs` (ou `http://localhost:<PORT>/api-docs`)
- Dev/Prod: `https://huma-backend-a0wj.onrender.com/api-docs`
