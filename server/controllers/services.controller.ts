import { Request, Response } from 'express';
import { ServiceModel } from '../models/service.model';

export const ServicesController = {
  getAll: (req: Request, res: Response) => {
    try {
      const services = ServiceModel.findAll();
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getById: (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const service = ServiceModel.findById(id);
      if (!service) return res.status(404).json({ message: 'Service not found' });
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  create: (req: Request, res: Response) => {
    try {
      const id = ServiceModel.create(req.body);
      res.status(201).json({ id, ...req.body });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
