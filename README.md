Projet Huma - Backend

API Express pour Huma.

## Démarrage rapide
```bash
npm install
npm run dev
```

Le backend démarre sur `http://localhost:3000` par défaut.

## Variables d'environnement
Variables minimales :
- `DATABASE_URL`
- `JWT_SECRET`

Variables utiles :
- `PORT` (défaut `3000`)
- `NODE_ENV` (mettre `development` pour activer le seed)
- `JWT_EXPIRES_IN`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GROQ_TIMEOUT_MS`

## Seed local de démo
En mode `development`, le backend seed automatiquement un dataset de démonstration stable sur `30 jours`.

Comptes créés :
- `admin@local.test`
- `manager1@local.test`
- `manager2@local.test`
- `employee01@local.test` à `employee20@local.test`

Mot de passe partagé :
- `adminadmin`

Organisation seedée :
- `1` organisation
- `2` équipes
- `2` managers
- `20` employés
- onboarding complété pour tous les membres d'équipe
- check-ins réalistes sur `1 mois`
- feedbacks réalistes orientés démo IA

Le seed est idempotent et ne s'exécute pas hors `development`.

## Scénarios de démo
Le seed est conçu pour montrer deux cas d'usage très contrastés dans le front et dans les endpoints IA.

### Scénario 1 - Équipe saine
- Équipe : `Equipe A`
- Manager : `manager1@local.test`
- Employés : `employee01@local.test` à `employee10@local.test`
- Profil :
  - participation élevée et régulière
  - humeur globalement bonne
  - dynamique stable
  - feedbacks peu nombreux et plutôt constructifs
  - facteurs fréquents : reconnaissance, relations, motivation

Ce scénario est utile pour montrer :
- une équipe qui fonctionne bien
- une synthèse IA rassurante et crédible
- des points forts identifiés sans signal d'alerte majeur

### Scénario 2 - Équipe sous tension
- Équipe : `Equipe B`
- Manager : `manager2@local.test`
- Employés : `employee11@local.test` à `employee20@local.test`
- Profil :
  - participation plus irrégulière
  - humeur plus basse
  - fatigue progressive sur le mois
  - feedbacks plus nombreux et plus explicites
  - facteurs dominants : charge de travail, clarté, équilibre vie pro / vie perso, motivation

Ce scénario est utile pour montrer :
- la détection d'une équipe qui va mal
- la valeur des synthèses IA hebdomadaires
- le rapport d'analyse manager avec points faibles, actions et activités recommandées

## Comptes à utiliser pour la démo
Vue manager :
- `manager1@local.test` / `adminadmin` pour l'équipe saine
- `manager2@local.test` / `adminadmin` pour l'équipe sous tension

Vue salarié :
- `employee01@local.test` / `adminadmin` pour l'équipe saine
- `employee11@local.test` / `adminadmin` pour l'équipe sous tension

Vue admin :
- `admin@local.test` / `adminadmin`

## Endpoints utiles pour le front
Authentification :
- `POST /auth/login`
- `GET /users/me`

Vue équipe :
- `GET /team/stats`
- `GET /team/weekly-summary`
- `GET /team/weekly-factors`
- `GET /team/weekly-insight`

Vue manager IA :
- `GET /team/weekly-analysis-report`

Feedbacks :
- `POST /feedbacks`
- `GET /feedbacks/history`

Check-ins individuels :
- `POST /checkins`
- `GET /checkins/history`
- `GET /checkins/weekly-summary`
- `GET /checkins/weekly-factors`

## Parcours de démo conseillé
### Démo salarié / "Mon équipe"
1. Se connecter avec `employee01@local.test` ou `employee11@local.test`
2. Charger `GET /team/stats`
3. Charger `GET /team/weekly-summary`
4. Charger `GET /team/weekly-factors`
5. Charger `GET /team/weekly-insight`

Ce parcours permet de comparer une équipe saine et une équipe en difficulté dans le même écran front.

### Démo manager / rapport d'analyse
1. Se connecter avec `manager1@local.test`
2. Charger `GET /team/weekly-analysis-report`
3. Refaire la même chose avec `manager2@local.test`

Le contraste attendu :
- `manager1` : rapport plus stable, points forts plus visibles, peu d'alertes
- `manager2` : irritants plus lourds, actions correctives plus prioritaires, activités d'équipe en complément

## Collection Postman
La collection `postman/postman.json` contient :
- les logins seed
- les endpoints équipe classiques
- les endpoints IA
- des scénarios de démo prêts à jouer pour :
  - équipe saine
  - équipe sous tension
  - vue manager
  - vue salarié

Conseil d'usage :
1. lancer `login (manager healthy demo)` ou `login (manager struggling demo)`
2. exécuter les requêtes du dossier `demo scenarios`

## Commandes utiles
```bash
# installation
npm install

# développement
npm run dev

# production
npm start

# tests
npm test
```

## Base URL
Local :
- `http://localhost:3000`

Render :
- `https://huma-backend-a0wj.onrender.com`

## Docs API (Swagger)
- Local : `http://localhost:3000/api-docs`
- Render : `https://huma-backend-a0wj.onrender.com/api-docs`
