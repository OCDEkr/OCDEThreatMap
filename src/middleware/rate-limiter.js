/**
 * Rate Limiting Middleware
 * Protects against brute force attacks
 */

const rateLimit = require('express-rate-limit');
const { logSecurityEvent, getClientIP } = require('../utils/security');

/**
 * Login rate limiter - strict limits for authentication endpoint
 * 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = getClientIP(req);
    logSecurityEvent('rate_limited', {
      ip,
      endpoint: '/login',
      username: req.body?.username || 'unknown'
    });
    res.status(429).json(options.message);
  },
  keyGenerator: (req) => getClientIP(req)
});

/**
 * API rate limiter - general API protection
 * 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req)
});

/**
 * Password change rate limiter
 * 3 attempts per hour per IP
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: 'Too many password change attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = getClientIP(req);
    logSecurityEvent('rate_limited', {
      ip,
      endpoint: '/api/change-password'
    });
    res.status(429).json(options.message);
  },
  keyGenerator: (req) => getClientIP(req)
});

/**
 * Threat feed rate limiter
 * 10 requests per minute per IP
 */
const threatFeedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    error: 'Too many threat feed requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req)
});

module.exports = {
  loginLimiter,
  apiLimiter,
  passwordChangeLimiter,
  threatFeedLimiter
};
