const feedbackService = require('../services/feedbackService');

const getFeedbacks = async (req, res, next) => {
  try {
    const result = await feedbackService.getFeedbacks({ userId: req.user.id });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createFeedback = async (req, res, next) => {
  try {
    const result = await feedbackService.createFeedback({
      userId: req.user.id,
      category: req.body.category,
      feedbackText: req.body.feedbackText,
      solutionText: req.body.solutionText,
      isAnonymous: req.body.isAnonymous
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFeedbacks,
  createFeedback,
};
