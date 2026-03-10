const feedbackService = require('../services/feedbackService');

const listPublicFeedbacks = async (req, res, next) => {
  try {
    const result = await feedbackService.listPublicFeedbacks();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

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

const updateFeedbackStatus = async (req, res, next) => {
  try {
    const result = await feedbackService.updateFeedbackStatus({
      feedbackId: req.params.id,
      status: req.body.status,
      userRole: req.user.role
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPublicFeedbacks,
  getFeedbacks,
  updateFeedbackStatus,
  createFeedback,
};
