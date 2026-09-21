const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { logAction } = require('../services/auditService');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({ name, email, password });

  await logAction({
    action: 'user_registered',
    entityType: 'User',
    entityId: user._id,
    performedBy: user._id,
    metadata: { email: user.email },
  });

  const token = signToken(user);
  res.status(201).json({ success: true, token, user: user.toSafeObject() });
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password');

  await logAction({
    action: 'user_login',
    entityType: 'User',
    entityId: user._id,
    performedBy: user._id,
    metadata: { email: user.email },
  });

  const token = signToken(user);
  res.json({ success: true, token, user: user.toSafeObject() });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

module.exports = { register, login, getMe };
