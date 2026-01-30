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
 *     responses:
 *       200:
 *         description: Check-in saved
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
 *     summary: Get weekly summary
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
 *         description: Week start date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Weekly summary
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/weekly-summary', authenticate, validate(checkinSchemas.weeklySummary), checkinController.getWeeklySummary);

console.log('Loading checkins routes...');
console.log('Checkins Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Checkin Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
