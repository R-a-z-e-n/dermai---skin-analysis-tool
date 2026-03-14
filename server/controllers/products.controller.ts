import { Request, Response } from 'express';
import { ProductModel } from '../models/product.model';

export const ProductsController = {
  getAll: (req: Request, res: Response) => {
    try {
      const products = ProductModel.findAll();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  getById: (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const product = ProductModel.findById(id);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  create: (req: Request, res: Response) => {
    try {
      const id = ProductModel.create(req.body);
      res.status(201).json({ id, ...req.body });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  update: (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      ProductModel.update(id, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  delete: (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      ProductModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
