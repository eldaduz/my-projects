export const adminMiddleware = (req, res, next) => {
  try {
    if (req.user?.role === 'admin') {
      return next();
    }

    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
