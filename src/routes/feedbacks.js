const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const feedbackSchemas = require('../validators/feedbackSchemas');

// GET /api/feedbacks - Lister l'historique des feedbacks
router.get('/', authenticate, feedbackController.getFeedbacks);

// POST /api/feedbacks - Créer un nouveau ticket
router.post('/', authenticate, validate(feedbackSchemas.createFeedback), feedbackController.createFeedback);

console.log('Loading feedbacks routes...');
console.log('Feedbacks Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Feedback Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
