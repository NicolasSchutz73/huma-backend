const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const checkinSchemas = require('../validators/checkinSchemas');

// GET /checkins/today - Savoir si l'utilisateur a déjà répondu aujourd'hui
/**
 * @swagger
 * /checkins/today:
 *   get:
 *     tags: [Checkins]
 *     summary: Check if the user already submitted today
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *     responses:
 *       200:
 *         description: Check-in status
 *         content:
 *           application/json:
 *             example:
 *               hasCheckedIn: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/today', authenticate, checkinController.getTodayCheckin);

// POST /checkins - Soumettre le formulaire de check-in
/**
 * @swagger
 * /checkins:
 *   post:
 *     tags: [Checkins]
 *     summary: Submit a check-in
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               moodValue:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *               causes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [WORKLOAD, RELATIONS, MOTIVATION, CLARITY, RECOGNITION, BALANCE]
 *               comment:
 *                 type: string
 *               timestamp:
 *                 type: string
 *             required: [moodValue, timestamp]
 *           example:
 *             moodValue: 85
 *             causes: [WORKLOAD, BALANCE]
 *             comment: Super journée!
 *             timestamp: "2026-01-30T11:00:00Z"
 *     responses:
 *       200:
 *         description: Check-in saved
 *         content:
 *           application/json:
 *             example:
 *               message: Check-in créé avec succès
 *               checkin:
 *                 id: c258f2a5-f6ea-4905-8496-a470284ea28b
 *                 moodValue: 85
 *                 causes: [WORKLOAD, BALANCE]
 *                 comment: Super journée!
 *                 timestamp: "2026-01-30T11:00:00Z"
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, validate(checkinSchemas.createCheckin), checkinController.createCheckin);

// GET /checkins/history - Afficher l'historique des check-ins
/**
 * @swagger
 * /checkins/history:
 *   get:
 *     tags: [Checkins]
 *     summary: Get check-in history
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *       - in: query
 *         name: days
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *         description: Number of days to include
 *     responses:
 *       200:
 *         description: Check-in history
 *         content:
 *           application/json:
 *             example:
 *               - date: "2026-01-30"
 *                 status: completed
 *                 moodValue: 85
 *               - date: "2026-01-29"
 *                 status: missed
 *                 moodValue: null
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history', authenticate, validate(checkinSchemas.history), checkinController.getHistory);

// GET /checkins/weekly-summary - Récapitulatif semaine (lundi -> vendredi)
/**
 * @swagger
 * /checkins/weekly-summary:
 *   get:
 *     tags: [Checkins]
 *     summary: Get weekly/monthly/yearly summary
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
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
 *         description: Date reference (YYYY-MM-DD for week, YYYY-MM for month, YYYY for year)
 *     responses:
 *       200:
 *         description: Period summary
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-01-26"
 *               weekEnd: "2026-01-30"
 *               period: week
 *               participation: 4
 *               averageMood: 7.8
 *               daily:
 *                 - date: "2026-01-26"
 *                   moodValue: 80
 *                   label: Jour excellent
 *                 - date: "2026-01-27"
 *                   moodValue: null
 *                   label: Aucun check-in
 *               stats:
 *                 excellentDays: 2
 *                 correctDays: 1
 *                 difficultDays: 1
 *                 missingDays: 1
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/weekly-summary', authenticate, validate(checkinSchemas.weeklySummary), checkinController.getWeeklySummary);

// GET /checkins/weekly-factors - Facteurs d'influence (semaine)
/**
 * @swagger
 * /checkins/weekly-factors:
 *   get:
 *     tags: [Checkins]
 *     summary: Get weekly/monthly/yearly factors summary
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: header
 *         name: X-User-Id
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
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
 *         description: Date reference (YYYY-MM-DD for week, YYYY-MM for month, YYYY for year)
 *     responses:
 *       200:
 *         description: Period factors summary
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-01-26"
 *               weekEnd: "2026-01-30"
 *               period: week
 *               availableCauses: [WORKLOAD, BALANCE]
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
 *               byCause:
 *                 WORKLOAD:
 *                   totalCheckins: 3
 *                   buckets:
 *                     - label: Serein
 *                       range: [61, 80]
 *                       count: 2
 *                       percent: 67
 *                     - label: Épanoui
 *                       range: [81, 100]
 *                       count: 1
 *                       percent: 33
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/weekly-factors', authenticate, validate(checkinSchemas.weeklyFactors), checkinController.getWeeklyFactors);

console.log('Loading checkins routes...');
console.log('Checkins Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Checkin Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
