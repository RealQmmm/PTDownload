const authService = require('../services/authService');

const authMiddleware = (req, res, next) => {
    // Path to skip auth (relative to /api)
    const skipPaths = ['/auth/login', '/health'];
    if (skipPaths.includes(req.path)) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    req.user = decoded;
    next();
};

module.exports = authMiddleware;
