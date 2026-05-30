import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return res.status(401).json({ message: 'Token is missing' });
    }

    const [tokenType, token] = authorizationHeader.split(' ');

    if (tokenType !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Token is missing' });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decodedToken.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token is invalid or expired' });
    }

    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
