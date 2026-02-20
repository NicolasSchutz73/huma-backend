const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { jwtSecret, jwtExpiresIn } = require('../config');
const organizationRepository = require('../repositories/organizationRepository');
const userRepository = require('../repositories/userRepository');
const { AppError } = require('../utils/errors');

const createToken = (userId) => {
  if (!jwtSecret) {
    throw new AppError('JWT secret not configured', 500, 'CONFIG_ERROR');
  }
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

const register = async ({ email }) => {
  if (!email) {
    throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
  }

  let orgId = await organizationRepository.getAnyOrganizationId();
  if (!orgId) {
    orgId = uuidv4();
    await organizationRepository.createOrganization(orgId, 'Default Organization');
  }

  const userId = uuidv4();
  const role = 'employee';

  try {
    await userRepository.createUser({ id: userId, email, organizationId: orgId, role });
  } catch (err) {
    if (err.code === '23505' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      throw new AppError('Email already exists', 409, 'CONFLICT');
    }
    throw err;
  }

  return {
    message: 'User registered successfully',
    token: createToken(userId),
    tokenType: 'Bearer',
    expiresIn: jwtExpiresIn,
    user: {
      id: userId,
      email,
      role,
      organization_id: orgId
    }
  };
};

const login = async ({ email }) => {
  if (!email) {
    throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
  }

  const user = await userRepository.getByEmail(email);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return {
    message: 'Login successful',
    token: createToken(user.id),
    tokenType: 'Bearer',
    expiresIn: jwtExpiresIn,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      firstName: user.first_name,
      lastName: user.last_name,
      onboardingCompleted: !!user.onboarding_completed
    }
  };
};

module.exports = {
  register,
  login
};
