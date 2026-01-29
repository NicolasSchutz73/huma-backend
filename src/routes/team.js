const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const teamSchemas = require('../validators/teamSchemas');

// GET /team/stats - Afficher les stats d'équipe
router.get('/stats', authenticate, validate(teamSchemas.stats), teamController.getTeamStats);

// POST /team - Créer une équipe
router.post('/', authenticate, validate(teamSchemas.createTeam), teamController.createTeam);

// POST /team/members - Ajouter un utilisateur à une équipe
router.post('/members', authenticate, validate(teamSchemas.addMember), teamController.addMember);

console.log('Loading team routes...');
console.log('Team Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Team Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
