const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const userSchemas = require('../validators/userSchemas');

console.log('Loading users routes...');

// Toutes les routes de ce fichier sont protégées par authenticate
/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info
 *         content:
 *           application/json:
 *             example:
 *               id: 3b2e7a68-438e-4f93-9e49-4c0ab01d2f01
 *               email: test@example.com
 *               role: employee
 *               organization_id: 9a0a0b93-1d3c-4b1c-8e8f-2dd4d9c9c0e3
 *               first_name: Jean
 *               last_name: Dupont
 *               onboarding_completed: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/me', authenticate, userController.getUserInfo);

/**
 * @swagger
 * /users/me/weekly-insight:
 *   get:
 *     tags: [Users]
 *     summary: Generate a personal weekly insight
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         required: false
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *         description: Week start date (YYYY-MM-DD). Defaults to the current week.
 *     responses:
 *       200:
 *         description: AI-generated weekly personal insight
 *         content:
 *           application/json:
 *             example:
 *               weekStart: "2026-02-16"
 *               weekEnd: "2026-02-20"
 *               generated: true
 *               summaryText: "Ta semaine montre une dynamique stable avec une humeur moyenne de 8/10 et une participation solide (4 check-ins sur 5). Un léger creux apparaît en milieu de semaine, lié à ta charge et à ton rythme de travail, avant un retour à un climat plus serein. Globalement, les ressentis dominants restent positifs et témoignent d’une semaine plutôt équilibrée."
 *               metrics:
 *                 averageMood: 8
 *                 participation: 4
 *                 participationRate: 80
 *                 topCauses: [WORKLOAD, RECOGNITION]
 *                 feedbackCategories:
 *                   ORGANIZATION: 1
 *                 daily:
 *                   - date: "2026-02-16"
 *                     moodValue: 7.8
 *                     label: Jour excellent
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: AI generation failed
 *       500:
 *         description: Server error
 */
router.get('/me/weekly-insight', authenticate, validate(userSchemas.weeklyInsight), userController.getWeeklyInsight);

/**
 * @swagger
 * /users/me/onboarding:
 *   put:
 *     tags: [Users]
 *     summary: Complete user onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               work_style:
 *                 type: string
 *                 enum: [Collaboratif, Autonome, Structure, Structuré, Flexible]
 *               motivation_type:
 *                 type: string
 *                 enum: [Reconnaissance, Apprentissage, Impact, Equilibre, Équilibre]
 *               stress_source:
 *                 type: string
 *                 enum: [Charge de travail, Relations, Incertitude, Delais, Délais]
 *             required: [work_style, motivation_type, stress_source]
 *           example:
 *             work_style: Structuré
 *             motivation_type: Impact
 *             stress_source: Charge de travail
 *     responses:
 *       200:
 *         description: Onboarding completed
 *         content:
 *           application/json:
 *             example:
 *               message: Onboarding completed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/me/onboarding', authenticate, validate(userSchemas.completeOnboarding), userController.completeOnboarding);

/**
 * @swagger
 * /users/me/test:
 *   put:
 *     tags: [Users]
 *     summary: Test endpoint
 *     responses:
 *       200:
 *         description: Test response
 *         content:
 *           application/json:
 *             example:
 *               msg: Test OK
 *       500:
 *         description: Server error
*/
router.put('/me/test', (req, res) => res.json({msg: "Test OK"}));

/**
 * @swagger
 * /users/me/info:
 *   put:
 *     tags: [Users]
 *     summary: Update user information
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *             required: [first_name, last_name]
 *           example:
 *             first_name: Jean
 *             last_name: Dupont
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             example:
 *               message: User info updated successfully
 *               user:
 *                 id: 3b2e7a68-438e-4f93-9e49-4c0ab01d2f01
 *                 email: test@example.com
 *                 first_name: Jean
 *                 last_name: Dupont
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put('/me/info', authenticate, validate(userSchemas.updateUserInfo), userController.updateUserInfo);

console.log('Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
