const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             example:
 *               status: success
 *               message: Server is healthy
 *               timestamp: "2026-03-10T10:00:00.000Z"
 *       500:
 *         description: Server error
 */
router.get('/', healthController.getHealth);

module.exports = router;
