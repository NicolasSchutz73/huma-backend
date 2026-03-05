Projet Huma - Backend

API Express pour Huma.

## Demarrage rapide
```bash
npm install
npm run dev
```

## Seed local (dev)
- En mode `development`, le backend seed automatiquement un dataset local exploitable:
  - `1 admin`: `admin@local.test`
  - `2 managers`: `manager1@local.test`, `manager2@local.test`
  - `2 équipes` de `10 salariés` chacune (`employee01..employee20@local.test`)
  - `90 jours` de check-ins + quelques feedbacks
- Mot de passe seed partagé (dev): `adminadmin`
- Le seed est idempotent (pas de doublons).
- Aucun seed automatique en production.

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

## Auth
- Authentification: login par `email + password` + JWT Bearer.
- `POST /auth/register` et `POST /auth/login` exigent désormais `email` et `password` (min 8 caractères).

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
