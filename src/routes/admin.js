const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/auth');

/**
 * @swagger
 * /admin/seed:
 *   post:
 *     tags: [Admin]
 *     summary: Run development demo seed (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seed execution summary
 *         content:
 *           application/json:
 *             example:
 *               skipped: false
 *               users:
 *                 created: 23
 *               onboarding:
 *                 ensured: 22
 *               teams:
 *                 created: 2
 *               teamMembers:
 *                 ensured: 22
 *               checkins:
 *                 created: 419
 *                 updated: 0
 *                 deleted: 0
 *                 trimmedOlderRows: 1
 *               feedbacks:
 *                 created: 12
 *                 trimmedOlderRows: 1
 *                 cleanedLegacy: 1
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/seed', authenticate, adminController.runDevelopmentSeed);

module.exports = router;
