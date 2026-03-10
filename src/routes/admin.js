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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/seed', authenticate, adminController.runDevelopmentSeed);

module.exports = router;
