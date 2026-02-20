const teamService = require('../services/teamService');

const getTeamStats = async (req, res, next) => {
  try {
    const result = await teamService.getTeamStats({
      userId: req.user.id,
      queryTeamId: req.query.teamId
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getWeeklySummary = async (req, res, next) => {
  try {
    const result = await teamService.getWeeklySummary({
      userId: req.user.id,
      queryTeamId: req.query.teamId,
      period: req.query.period,
      weekStart: req.query.weekStart,
      date: req.query.date
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getWeeklyFactors = async (req, res, next) => {
  try {
    const result = await teamService.getWeeklyFactors({
      userId: req.user.id,
      queryTeamId: req.query.teamId,
      period: req.query.period,
      weekStart: req.query.weekStart,
      date: req.query.date
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createTeam = async (req, res, next) => {
  try {
    const result = await teamService.createTeam({
      name: req.body.name,
      organizationId: req.body.organizationId,
      userOrganizationId: req.user.organization_id
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const addMember = async (req, res, next) => {
  try {
    const result = await teamService.addMember({
      teamId: req.body.teamId,
      userId: req.body.userId
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTeamStats,
  getWeeklySummary,
  getWeeklyFactors,
  createTeam,
  addMember,
};
