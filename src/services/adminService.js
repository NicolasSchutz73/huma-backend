const config = require('../config');
const { seedDevelopmentData } = require('../db/seed');
const { AppError } = require('../utils/errors');

const runDevelopmentSeed = async ({ userRole }) => {
  if (userRole !== 'admin') {
    throw new AppError('Forbidden: admin role required', 403, 'FORBIDDEN');
  }

  if (config.env !== 'development') {
    throw new AppError('Development seed endpoint is only available in development', 403, 'FORBIDDEN');
  }

  const result = await seedDevelopmentData();
  if (result && result.failed) {
    throw new AppError('Development seed failed', 500, 'SEED_FAILED');
  }

  return result;
};

module.exports = {
  runDevelopmentSeed
};
