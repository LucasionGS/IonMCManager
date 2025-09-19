import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import process from "node:process";
import User from "../database/models/User.ts";

interface AuthRequest extends Request {
  user?: User;
}

type NextFunction = (err?: Error) => void;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: Omit<typeof User.prototype, 'password'>;
  token?: string;
}

namespace AuthController {
  export const router = Router();
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

  // Auth routes
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password }: LoginRequest = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          message: 'Username and password are required'
        } as AuthResponse);
        return;
      }

      // Find user by username or email
      const user = await User.findByUsername(username) || await User.findByEmail(username);
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        } as AuthResponse);
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Account is disabled'
        } as AuthResponse);
        return;
      }

      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        } as AuthResponse);
        return;
      }

      // Update last login
      await user.update({ lastLogin: new Date() });

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          role: user.role,
          isAdmin: user.isAdmin
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: user.toJSON(),
        token
      } as AuthResponse);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AuthResponse);
    }
  });

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { username, email, password, confirmPassword }: RegisterRequest = req.body;

      // Validation
      if (!username || !email || !password || !confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'All fields are required'
        } as AuthResponse);
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        } as AuthResponse);
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        } as AuthResponse);
        return;
      }

      // Check if user already exists
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Username already exists'
        } as AuthResponse);
        return;
      }

      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        res.status(400).json({
          success: false,
          message: 'Email already registered'
        } as AuthResponse);
        return;
      }

      // Check if this is the first user (make them admin)
      const userCount = await User.count();
      const role = userCount === 0 ? 'admin' : 'user';

      const user = await User.createUser({
        username,
        email,
        password,
        role,
        isActive: true,
        serverLimit: 5
      });

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username,
          role: user.role,
          isAdmin: user.isAdmin
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: user.toJSON(),
        token
      } as AuthResponse);

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AuthResponse);
    }
  });

  router.post('/logout', (_req: Request, res: Response) => {
    // For JWT, logout is handled client-side by removing the token
    res.json({
      success: true,
      message: 'Logout successful'
    } as AuthResponse);
  });

  router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated'
        } as AuthResponse);
        return;
      }

      res.json({
        success: true,
        user: {
          ...req.user.toJSON()
        }
      } as AuthResponse);

    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AuthResponse);
    }
  });

  router.post('/verify-token', (req: Request, res: Response) => {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      } as AuthResponse);
      return;
    }

    try {
      jwt.verify(token, jwtSecret);
      res.json({
        success: true,
        message: 'Token is valid'
      } as AuthResponse);
    } catch (_error) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      } as AuthResponse);
    }
  });

  router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated'
        } as AuthResponse);
        return;
      }

      if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'All password fields are required'
        } as AuthResponse);
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'New passwords do not match'
        } as AuthResponse);
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        } as AuthResponse);
        return;
      }

      const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        } as AuthResponse);
        return;
      }

      await req.user.update({ password: newPassword });

      res.json({
        success: true,
        message: 'Password changed successfully'
      } as AuthResponse);

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AuthResponse);
    }
  });

  // Middleware to authenticate JWT token
  export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      } as AuthResponse);
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: number };
      const user = await User.findByPk(decoded.userId);
      
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Invalid token or user not active'
        } as AuthResponse);
        return;
      }

      req.user = user;
      next();
    } catch (_error) {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      } as AuthResponse);
    }
  }
}

export default AuthController;