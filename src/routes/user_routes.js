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
 *         description: User info
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me', authenticate, userController.getUserInfo);

/**
 * @swagger
 * /users/me/onboarding:
 *   put:
 *     tags: [Users]
 *     summary: Complete user onboarding
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
 *               work_style:
 *                 type: string
 *               motivation_type:
 *                 type: string
 *               stress_source:
 *                 type: string
 *             required: [work_style, motivation_type, stress_source]
 *     responses:
 *       200:
 *         description: Onboarding completed
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
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *             required: [first_name, last_name]
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
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
