import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { generateToken } from '../utils/tokenUtils.js';

// Number of bcrypt rounds — higher = slower but more resistant to brute force.
const SALT_ROUNDS = 10;

// Server-side validation regardless of client-side checks — never trust the client.
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Password policy: min 8 chars, at least one uppercase, lowercase, and digit.
const isValidPassword = (password) => {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
};

export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password does not meet the required rules' });
    }

    // Normalize before checking duplicates so "User@Email.com" and "user@email.com" match.
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // Store the hash, never the raw password. bcrypt handles salting internally.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'user',
    });

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
    });

    return res.status(201).json({
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Same error message for "email not found" and "wrong password"
    // prevents attackers from discovering which emails are registered.
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
    });

    return res.status(200).json({
      message: 'Login successful',
      data: {
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

// Returns the user attached by authMiddleware — no DB query needed here.
export const getCurrentUser = (req, res) => {
  return res.status(200).json({
    message: 'Current user loaded successfully',
    data: {
      user: req.user,
    },
  });
};
