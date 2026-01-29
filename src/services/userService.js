const userRepository = require('../repositories/userRepository');
const { AppError } = require('../utils/errors');

const updateUserInfo = async ({ userId, firstName, lastName }) => {
  if (!firstName || !lastName) {
    throw new AppError('First name and last name are required', 400, 'VALIDATION_ERROR');
  }

  await userRepository.updateNames({ userId, firstName, lastName });
  const user = await userRepository.getById(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return {
    message: 'User info updated successfully',
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  };
};

const completeOnboarding = async ({ userId, workStyle, motivationType, stressSource }) => {
  const normalizeMap = {
    Structure: 'Structuré',
    Equilibre: 'Équilibre',
    Delais: 'Délais'
  };

  const normalizedWorkStyle = normalizeMap[workStyle] || workStyle;
  const normalizedMotivationType = normalizeMap[motivationType] || motivationType;
  const normalizedStressSource = normalizeMap[stressSource] || stressSource;

  const validWorkStyles = ['Collaboratif', 'Autonome', 'Structuré', 'Flexible'];
  const validMotivationTypes = ['Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre'];
  const validStressSources = ['Charge de travail', 'Relations', 'Incertitude', 'Délais'];

  if (!validWorkStyles.includes(normalizedWorkStyle)) {
    throw new AppError(
      `Invalid work_style. Must be one of: ${validWorkStyles.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!validMotivationTypes.includes(normalizedMotivationType)) {
    throw new AppError(
      `Invalid motivation_type. Must be one of: ${validMotivationTypes.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!validStressSources.includes(normalizedStressSource)) {
    throw new AppError(
      `Invalid stress_source. Must be one of: ${validStressSources.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  await userRepository.updateOnboarding({
    userId,
    workStyle: normalizedWorkStyle,
    motivationType: normalizedMotivationType,
    stressSource: normalizedStressSource
  });

  return {
    message: 'Onboarding completed successfully'
  };
};

const getUserInfo = async ({ userId }) => {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return user;
};

module.exports = {
  updateUserInfo,
  completeOnboarding,
  getUserInfo
};
