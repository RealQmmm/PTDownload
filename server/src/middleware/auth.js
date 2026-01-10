const authService = require('../services/authService');

const authMiddleware = (req, res, next) => {
    // Path to skip auth (relative to /api)
    const skipPaths = ['/auth/login', '/health', '/settings/public'];
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

const requireAdmin = (req, res, next) => {
    // Get fresh user data from database to ensure role is up-to-date
    const user = authService.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = user; // Update req.user with fresh data
    next();
};

module.exports = {
    authMiddleware,
    requireAdmin
};
