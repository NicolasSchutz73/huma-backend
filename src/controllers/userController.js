const userService = require('../services/userService');

const updateUserInfo = async (req, res, next) => {
  try {
    const result = await userService.updateUserInfo({
      userId: req.user.id,
      firstName: req.body.first_name,
      lastName: req.body.last_name
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const completeOnboarding = async (req, res, next) => {
  try {
    const result = await userService.completeOnboarding({
      userId: req.user.id,
      workStyle: req.body.work_style,
      motivationType: req.body.motivation_type,
      stressSource: req.body.stress_source
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getUserInfo = async (req, res, next) => {
  try {
    const result = await userService.getUserInfo({ userId: req.user.id });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateUserInfo,
  completeOnboarding,
  getUserInfo,
};
