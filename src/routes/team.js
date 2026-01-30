const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const teamSchemas = require('../validators/teamSchemas');

// GET /team/stats - Afficher les stats d'équipe
/**
 * @swagger
 * /team/stats:
 *   get:
 *     tags: [Team]
 *     summary: Get team statistics
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
 *         name: teamId
 *         required: false
 *         schema:
 *           type: string
 *         description: Team identifier
 *     responses:
 *       200:
 *         description: Team statistics
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, validate(teamSchemas.stats), teamController.getTeamStats);

// POST /team - Créer une équipe
/**
 * @swagger
 * /team:
 *   post:
 *     tags: [Team]
 *     summary: Create a team
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
 *               name:
 *                 type: string
 *               organizationId:
 *                 type: string
 *             required: [name]
 *     responses:
 *       200:
 *         description: Team created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, validate(teamSchemas.createTeam), teamController.createTeam);

// POST /team/members - Ajouter un utilisateur à une équipe
/**
 * @swagger
 * /team/members:
 *   post:
 *     tags: [Team]
 *     summary: Add a user to a team
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
 *               teamId:
 *                 type: string
 *               userId:
 *                 type: string
 *             required: [teamId, userId]
 *     responses:
 *       200:
 *         description: Team member added
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/members', authenticate, validate(teamSchemas.addMember), teamController.addMember);

console.log('Loading team routes...');
console.log('Team Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Team Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
