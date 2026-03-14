import { Response } from 'express';
import { BookingModel } from '../models/booking.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const BookingsController = {
  getUserBookings: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const bookings = BookingModel.findByUserId(req.user.id);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  create: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { service_id, date } = req.body;
      if (!service_id || !date) return res.status(400).json({ message: 'Missing required fields' });

      const id = BookingModel.create({
        user_id: req.user.id,
        service_id,
        date
      });
      res.status(201).json({ id, service_id, date, status: 'pending' });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  updateStatus: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      BookingModel.updateStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
