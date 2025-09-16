const helmet = require('helmet');
const { helmet: helmetConfig } = require('../../config/security.config');

// Configure security headers
const securityHeaders = (app) => {
  // Basic Helmet configuration
  app.use(helmet({
    contentSecurityPolicy: helmetConfig.contentSecurityPolicy,
    hsts: helmetConfig.hsts,
  }));

  // Additional security headers
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove powered by header
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Tenant-Isolated', 'true');
    res.setHeader('X-Request-ID', generateRequestId());
    
    next();
  });

  // CORS preflight handling
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
    res.header('Access-Control-Max-Age', '86400');
    res.status(204).send();
  });
};

// Generate unique request ID for tracking
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = securityHeaders;
