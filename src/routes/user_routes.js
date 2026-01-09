const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');

console.log('Loading users routes...');

// Toutes les routes de ce fichier sont protégées par authenticate
router.put('/me/onboarding', authenticate, userController.completeOnboarding);
router.put('/me/test', (req, res) => res.json({msg: "Test OK"}));
router.put('/me/info', authenticate, userController.updateUserInfo);

console.log('Router stack size:', router.stack.length);
router.stack.forEach((r, i) => {
    if (r.route && r.route.path) {
        console.log(`Route ${i}: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});

module.exports = router;