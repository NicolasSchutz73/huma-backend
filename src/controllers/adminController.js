const adminService = require('../services/adminService');

const runDevelopmentSeed = async (req, res, next) => {
  try {
    const result = await adminService.runDevelopmentSeed({
      userRole: req.user.role
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  runDevelopmentSeed
};
