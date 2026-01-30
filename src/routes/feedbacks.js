const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const feedbackSchemas = require('../validators/feedbackSchemas');

// GET /api/feedbacks - Lister l'historique des feedbacks
/**
 * @swagger
 * /feedbacks:
 *   get:
 *     tags: [Feedbacks]
 *     summary: List feedback history
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
 *         description: Feedback list
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, feedbackController.getFeedbacks);

// POST /api/feedbacks - Créer un nouveau ticket
/**
 * @swagger
 * /feedbacks:
 *   post:
 *     tags: [Feedbacks]
 *     summary: Create a feedback ticket
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
 *               category:
 *                 type: string
 *                 enum: [WORKLOAD, RELATIONS, MOTIVATION, ORGANIZATION, RECOGNITION, WORK_LIFE_BALANCE, FACILITIES]
 *               feedbackText:
 *                 type: string
 *               solutionText:
 *                 type: string
 *               isAnonymous:
 *                 type: boolean
 *             required: [category, feedbackText, solutionText]
 *     responses:
 *       200:
 *         description: Feedback created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, validate(feedbackSchemas.createFeedback), feedbackController.createFeedback);

console.log('Loading feedbacks routes...');
console.log('Feedbacks Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Feedback Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
