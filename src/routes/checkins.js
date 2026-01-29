const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const checkinSchemas = require('../validators/checkinSchemas');

// GET /checkins/today - Savoir si l'utilisateur a déjà répondu aujourd'hui
router.get('/today', authenticate, checkinController.getTodayCheckin);

// POST /checkins - Soumettre le formulaire de check-in
router.post('/', authenticate, validate(checkinSchemas.createCheckin), checkinController.createCheckin);

// GET /checkins/history - Afficher l'historique des check-ins
router.get('/history', authenticate, validate(checkinSchemas.history), checkinController.getHistory);

// GET /checkins/weekly-summary - Récapitulatif semaine (lundi -> vendredi)
router.get('/weekly-summary', authenticate, validate(checkinSchemas.weeklySummary), checkinController.getWeeklySummary);

console.log('Loading checkins routes...');
console.log('Checkins Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Checkin Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;
