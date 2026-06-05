// Authorization gate — always runs after authMiddleware, so req.user is guaranteed.
// Separates "who are you" (auth) from "are you allowed" (admin).
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
