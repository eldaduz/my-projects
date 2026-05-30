import jwt from 'jsonwebtoken';

export const generateToken = ({ userId, role }) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from .env');
  }

  return jwt.sign(
    {
      userId,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1h',
    },
  );
};
