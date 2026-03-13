/**
 * Contrôleur pour vérifier l'état du serveur.
 *
 * Répond avec un JSON décrivant la santé du serveur.
 *
 * @param res - Objet réponse Express.
 * @returns {void}
 *
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealth,
};
