const checkinService = require('../services/checkinService');

const getTodayCheckin = async (req, res, next) => {
  try {
    const result = await checkinService.getTodayCheckin({ userId: req.user.id });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createCheckin = async (req, res, next) => {
  try {
    const result = await checkinService.createCheckin({
      userId: req.user.id,
      moodValue: req.body.moodValue,
      causes: req.body.causes,
      comment: req.body.comment,
      timestamp: req.body.timestamp
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const result = await checkinService.getHistory({
      userId: req.user.id,
      days: req.query.days
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getWeeklySummary = async (req, res, next) => {
  try {
    const result = await checkinService.getWeeklySummary({
      userId: req.user.id,
      weekStart: req.query.weekStart
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTodayCheckin,
  createCheckin,
  getHistory,
  getWeeklySummary,
};
