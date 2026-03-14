import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const AuthController = {
  register: async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = UserModel.create({ name, email, password: hashedPassword });
      
      const token = jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
      
      res.status(201).json({ token, user: { id: userId, name, email, role: 'user' } });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const user = UserModel.findByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      
      delete user.password;
      res.json({ token, user });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  me: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const user = UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
