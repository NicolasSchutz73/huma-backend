const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const feedbackSchemas = require('../validators/feedbackSchemas');

// GET /api/feedbacks - Lister tous les feedbacks de manière anonymisée
/**
 * @swagger
 * /feedbacks:
 *   get:
 *     tags: [Feedbacks]
 *     summary: List all feedbacks for authenticated users without exposing authors
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback list
 *         content:
 *           application/json:
 *             example:
 *               - id: 1d1f5fd8-8e2a-4df6-9960-2e32a95ef0e9
 *                 category: ORGANIZATION
 *                 date: "2026-03-10"
 *                 status: pending
 *                 feedbackText: Les priorités changent trop souvent.
 *                 solutionText: Clarifier les arbitrages du lundi.
 *                 isAnonymous: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, feedbackController.listPublicFeedbacks);

// GET /api/feedbacks/mine - Lister l'historique des feedbacks de l'utilisateur connecté
/**
 * @swagger
 * /feedbacks/mine:
 *   get:
 *     tags: [Feedbacks]
 *     summary: List current user feedback history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback list for current user
 *         content:
 *           application/json:
 *             example:
 *               - id: 1d1f5fd8-8e2a-4df6-9960-2e32a95ef0e9
 *                 category: ORGANIZATION
 *                 date: "2026-03-10"
 *                 status: pending
 *                 preview: Les priorités changent trop so...
 *                 isAnonymous: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/mine', authenticate, feedbackController.getFeedbacks);

// PATCH /api/feedbacks/:id/status - Mettre à jour le statut d'un feedback
/**
 * @swagger
 * /feedbacks/{id}/status:
 *   patch:
 *     tags: [Feedbacks]
 *     summary: Update feedback status (manager or admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, vu, en_cours, resolu, archive]
 *             required: [status]
 *           example:
 *             status: resolu
 *     responses:
 *       200:
 *         description: Feedback status updated
 *         content:
 *           application/json:
 *             example:
 *               message: Statut du feedback mis à jour
 *               feedback:
 *                 id: 1d1f5fd8-8e2a-4df6-9960-2e32a95ef0e9
 *                 category: ORGANIZATION
 *                 date: "2026-03-10"
 *                 status: resolu
 *                 feedbackText: Les priorités changent trop souvent.
 *                 solutionText: Clarifier les arbitrages du lundi.
 *                 isAnonymous: true
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/status',
  authenticate,
  validate(feedbackSchemas.updateFeedbackStatus),
  feedbackController.updateFeedbackStatus
);

// POST /api/feedbacks - Créer un nouveau ticket
/**
 * @swagger
 * /feedbacks:
 *   post:
 *     tags: [Feedbacks]
 *     summary: Create a feedback ticket
 *     security:
 *       - bearerAuth: []
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
 *           example:
 *             category: ORGANIZATION
 *             feedbackText: "Les priorités changent trop souvent dans la semaine."
 *             solutionText: "Partager un ordre des priorités en début de sprint."
 *             isAnonymous: true
 *     responses:
 *       201:
 *         description: Feedback created
 *         content:
 *           application/json:
 *             example:
 *               message: Feedback créé avec succès
 *               feedback:
 *                 id: 1d1f5fd8-8e2a-4df6-9960-2e32a95ef0e9
 *                 category: ORGANIZATION
 *                 feedbackText: Les priorités changent trop souvent.
 *                 solutionText: Clarifier les arbitrages du lundi.
 *                 status: pending
 *                 isAnonymous: true
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
