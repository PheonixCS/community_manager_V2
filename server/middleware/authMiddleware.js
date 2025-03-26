/**
 * Middleware for authentication verification
 */
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

/**
 * Middleware to verify user authentication
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const authMiddleware = async (req, res, next) => {
  try {
    // For development or when auth is not critical, we can make this optional
    const isAuthRequired = config.auth && config.auth.required !== false;
    
    // Get token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];
    
    // If no token is provided
    if (!token) {
      // If auth is required, return error
      if (isAuthRequired) {
        return res.status(401).json({ error: 'Authorization required' });
      }
      // If auth is optional, continue without auth
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Find user by ID from token
    const user = await User.findById(decoded.id).select('-password');
    
    // If user not found
    if (!user) {
      if (isAuthRequired) {
        return res.status(401).json({ error: 'User not found' });
      }
      return next();
    }
    
    // Attach user to request object
    req.user = user;
    
    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // For token verification errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // For expired tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // For development environment, we can make auth optional
    if (process.env.NODE_ENV === 'development' || 
        (config.auth && config.auth.required === false)) {
      return next();
    }
    
    // For other errors
    return res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = authMiddleware;
