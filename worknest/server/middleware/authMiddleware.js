import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Authenticates every protected request by validating the JWT from the Authorization header.
export const authMiddleware = async (req, res, next) => {
  try {
    // Extract and validate the Bearer token format.
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return res.status(401).json({ message: 'Token is missing' });
    }

    const [tokenType, token] = authorizationHeader.split(' ');

    if (tokenType !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Token is missing' });
    }

    // Two-step verification: (1) check JWT signature + expiry, (2) confirm the user still exists.
    // This prevents using a valid token for a deleted or deactivated account.
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decodedToken.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Attach a sanitized user object (no passwordHash) so downstream handlers
    // can access user identity without an extra DB query.
    req.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    // Distinguish JWT errors (expired / tampered) from unexpected server errors.
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token is invalid or expired' });
    }

    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
