const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.register({ email: req.body.email });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login({ email: req.body.email });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
};
