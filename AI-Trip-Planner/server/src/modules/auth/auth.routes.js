import { Router } from 'express';
import { registerUser, loginUser, getCurrentUser, logoutUser } from './auth.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { authRateLimiter } from '../../middleware/authRateLimiter.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, registerUser);
authRouter.post('/login', authRateLimiter, loginUser);
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/logout', logoutUser);
