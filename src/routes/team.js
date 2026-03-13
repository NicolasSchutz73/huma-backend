const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const teamSchemas = require('../validators/teamSchemas');

// GET /team/stats - Afficher les stats d'équipe
/**
 * @swagger
 * /team/stats:
 *   get:
 *     tags: [Team]
 *     summary: Get team statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier
 *     responses:
 *       200:
 *         description: Team statistics
 *         content:
 *           application/json:
 *             example:
 *               globalScore: 7.4
 *               moodLabel: Tout va bien aujourd'hui
 *               distribution:
 *                 WORKLOAD: 50
 *                 RECOGNITION: 25
 *               weeklyTrend:
 *                 - day: L
 *                   value: 7.2
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, validate(teamSchemas.stats), teamController.getTeamStats);

/**
 * @swagger
 * /team/weekly-summary:
 *   get:
 *     tags: [Team]
 *     summary: Get team weekly/monthly/yearly summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier (optional if user belongs to at least one team)
 *       - in: query
 *         name: weekStart
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *         description: Week start date (YYYY-MM-DD). Used when period=week.
 *       - in: query
 *         name: period
 *         required: false
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *         description: Period type (week, month, year)
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}(-\\d{2}(-\\d{2})?)?$"
 *         description: Date reference (YYYY-MM-DD for week, YYYY-MM for month, YYYY for year)
 *     responses:
 *       200:
 *         description: Team period summary
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-02-16"
 *               weekEnd: "2026-02-20"
 *               period: week
 *               participation: 4
 *               averageMood: 7.2
 *               daily:
 *                 - date: "2026-02-16"
 *                   moodValue: 74
 *                   label: Jour excellent
 *                 - date: "2026-02-17"
 *                   moodValue: 68
 *                   label: Jour correct
 *               stats:
 *                 excellentDays: 2
 *                 correctDays: 2
 *                 difficultDays: 0
 *                 missingDays: 1
 *               dashboard:
 *                 averageMood:
 *                   value: 7.2
 *                   deltaVsPreviousWeek: 0.8
 *                 participation:
 *                   value: 80
 *                   deltaVsPreviousWeek: 10
 *                 qvtBarometer:
 *                   value: 6.4
 *                   deltaVsPreviousWeek: 0.3
 *                   label: Indice annuel évolutif
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/weekly-summary', authenticate, validate(teamSchemas.weeklySummary), teamController.getWeeklySummary);

/**
 * @swagger
 * /team/weekly-factors:
 *   get:
 *     tags: [Team]
 *     summary: Get team weekly/monthly/yearly factors summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier (optional if user belongs to at least one team)
 *       - in: query
 *         name: weekStart
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *         description: Week start date (YYYY-MM-DD). Used when period=week.
 *       - in: query
 *         name: period
 *         required: false
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *         description: Period type (week, month, year)
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}(-\\d{2}(-\\d{2})?)?$"
 *         description: Date reference (YYYY-MM-DD for week, YYYY-MM for month, YYYY for year)
 *     responses:
 *       200:
 *         description: Team period factors summary
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-02-16"
 *               weekEnd: "2026-02-20"
 *               period: week
 *               availableCauses: [WORKLOAD, CLARITY, RECOGNITION]
 *               summary:
 *                 totalCheckins: 4
 *                 buckets:
 *                   - label: Éprouvé
 *                     range: [0, 20]
 *                     count: 0
 *                     percent: 0
 *                   - label: Sous tension
 *                     range: [21, 40]
 *                     count: 1
 *                     percent: 25
 *                   - label: Serein
 *                     range: [61, 80]
 *                     count: 2
 *                     percent: 50
 *                   - label: Épanoui
 *                     range: [81, 100]
 *                     count: 1
 *                     percent: 25
 *               byCause:
 *                 WORKLOAD:
 *                   totalCheckins: 2
 *                   buckets:
 *                     - label: Serein
 *                       range: [61, 80]
 *                       count: 1
 *                       percent: 50
 *                     - label: Épanoui
 *                       range: [81, 100]
 *                       count: 1
 *                       percent: 50
 *                 CLARITY:
 *                   totalCheckins: 1
 *                   buckets:
 *                     - label: Sous tension
 *                       range: [21, 40]
 *                       count: 1
 *                       percent: 100
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/weekly-factors', authenticate, validate(teamSchemas.weeklyFactors), teamController.getWeeklyFactors);

/**
 * @swagger
 * /team/weekly-insight:
 *   get:
 *     tags: [Team]
 *     summary: Generate an AI weekly team insight
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier (optional if user belongs to at least one team)
 *       - in: query
 *         name: weekStart
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *         description: Week start date (YYYY-MM-DD). Defaults to the current week.
 *     responses:
 *       200:
 *         description: AI-generated weekly team insight
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-02-16"
 *               weekEnd: "2026-02-20"
 *               teamId: "team-1"
 *               generated: true
 *               summaryText: "Dynamique positive avec une humeur à 7,2/10 et une participation en hausse (80%)."
 *               metrics:
 *                 averageMood: 7.2
 *                 participation: 4
 *                 participationRate: 80
 *                 previousParticipationRate: 60
 *                 topCauses: [WORKLOAD, RECOGNITION]
 *                 feedbackCategories:
 *                   ORGANIZATION: 2
 *                   RECOGNITION: 1
 *                 daily:
 *                   - date: "2026-02-16"
 *                     moodValue: 7.4
 *                     label: Jour excellent
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       502:
 *         description: AI generation failed
 *       500:
 *         description: Server error
 */
router.get('/weekly-insight', authenticate, validate(teamSchemas.weeklyInsight), teamController.getWeeklyInsight);

/**
 * @swagger
 * /team/weekly-analysis-report:
 *   get:
 *     tags: [Team]
 *     summary: Generate a manager weekly team analysis report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier. Required for admins, optional for managers if they belong to one team.
 *       - in: query
 *         name: weekStart
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *         description: Week start date (YYYY-MM-DD). Defaults to the current week.
 *       - in: query
 *         name: forceRegenerate
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Force one additional generation if quota remains.
 *     responses:
 *       200:
 *         description: AI-generated weekly manager analysis report
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-02-16"
 *               weekEnd: "2026-02-20"
 *               teamId: "team-1"
 *               generated: true
 *               overview:
 *                 moodBand: correcte
 *                 averageMood: 6.8
 *                 participationRate: 80
 *                 trend: stable
 *                 trendStrength: faible
 *               strengthsSummary: L'équipe fonctionne humainement. Il faut capitaliser sur la cohésion.
 *               weaknessesSummary: Tant que la charge et le rythme ne sont pas traités, aucune activité d'équipe ne compensera durablement.
 *               strengths:
 *                 - rank: 1
 *                   title: Participation élevée et régulière
 *                   weight: 30
 *                   description: L'équipe répond largement présente sur la semaine.
 *               weaknesses:
 *                 - rank: 1
 *                   title: Charge de travail excessive ou mal priorisée
 *                   weight: 24
 *                   description: La charge semble peser sur le rythme collectif.
 *               recommendedActions:
 *                 - id: reduce-workload
 *                   title: Reprioriser la charge
 *                   priority: Haute
 *                   estimatedImpact: Fort
 *                   summary: Réduire la dispersion pour redonner de l'air à l'équipe.
 *                   checklist:
 *                     - Clarifier les priorités
 *               teamActivities:
 *                 - id: solution-retro
 *                   title: Rétro orientée solutions
 *                   estimatedImpact: Moyen
 *                   objective: Transformer les irritants en décisions concrètes
 *                   format: Atelier court
 *                   bullets:
 *                     - Identifier 3 irritants
 *                   benefit: Alignement
 *               reportMeta:
 *                 fromCache: false
 *                 generationCount: 1
 *                 generationLimit: 2
 *                 canRegenerate: true
 *                 generatedAt: "2026-02-21T09:30:00.000Z"
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Team not found
 *       502:
 *         description: AI generation failed
 *       500:
 *         description: Server error
 */
router.get(
  '/weekly-analysis-report',
  authenticate,
  validate(teamSchemas.weeklyAnalysisReport),
  teamController.getWeeklyAnalysisReport
);

// POST /team - Créer une équipe
/**
 * @swagger
 * /team:
 *   post:
 *     tags: [Team]
 *     summary: Create a team
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               organizationId:
 *                 type: string
 *             required: [name]
 *           example:
 *             name: "Equipe Produit"
 *             organizationId: "9a0a0b93-1d3c-4b1c-8e8f-2dd4d9c9c0e3"
 *     responses:
 *       201:
 *         description: Team created
 *         content:
 *           application/json:
 *             example:
 *               message: Équipe créée avec succès
 *               team:
 *                 id: 0a3a4688-13d7-4e23-90ea-c481f116fd36
 *                 name: Equipe A
 *                 organizationId: 9a0a0b93-1d3c-4b1c-8e8f-2dd4d9c9c0e3
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, validate(teamSchemas.createTeam), teamController.createTeam);

// POST /team/members - Ajouter un utilisateur à une équipe
/**
 * @swagger
 * /team/members:
 *   post:
 *     tags: [Team]
 *     summary: Add a user to a team
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamId:
 *                 type: string
 *               userId:
 *                 type: string
 *             required: [teamId, userId]
 *           example:
 *             teamId: "0a3a4688-13d7-4e23-90ea-c481f116fd36"
 *             userId: "3b2e7a68-438e-4f93-9e49-4c0ab01d2f01"
 *     responses:
 *       201:
 *         description: Team member added
 *         content:
 *           application/json:
 *             example:
 *               message: Membre ajouté avec succès
 *               member:
 *                 id: c258f2a5-f6ea-4905-8496-a470284ea28b
 *                 teamId: 0a3a4688-13d7-4e23-90ea-c481f116fd36
 *                 userId: 3b2e7a68-438e-4f93-9e49-4c0ab01d2f01
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Team or user not found
 *       409:
 *         description: User is already a member of the team
 *       500:
 *         description: Server error
 */
router.post('/members', authenticate, validate(teamSchemas.addMember), teamController.addMember);

console.log('Loading team routes...');
console.log('Team Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Team Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
