const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const authSchemas = require('../validators/authSchemas');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required: [email]
 *     responses:
 *       200:
 *         description: User registered
 *         content:
 *           application/json:
 *             example:
 *               message: User registered successfully
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               tokenType: Bearer
 *               expiresIn: 7d
 *               user:
 *                 id: 3b2e7a68-438e-4f93-9e49-4c0ab01d2f01
 *                 email: test@example.com
 *                 role: employee
 *                 organization_id: 9a0a0b93-1d3c-4b1c-8e8f-2dd4d9c9c0e3
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/register', validate(authSchemas.register), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required: [email]
 *     responses:
 *       200:
 *         description: Login success
 *         content:
 *           application/json:
 *             example:
 *               message: Login successful
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               tokenType: Bearer
 *               expiresIn: 7d
 *               user:
 *                 id: 3b2e7a68-438e-4f93-9e49-4c0ab01d2f01
 *                 email: test@example.com
 *                 role: employee
 *                 organizationId: 9a0a0b93-1d3c-4b1c-8e8f-2dd4d9c9c0e3
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/login', validate(authSchemas.login), authController.login);

module.exports = router;
