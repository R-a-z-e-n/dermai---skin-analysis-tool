import { Response } from 'express';
import { WishlistModel } from '../models/wishlist.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const WishlistsController = {
  getUserWishlist: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      const wishlist = WishlistModel.findByUserId(req.user.id);
      res.json(wishlist);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  addProduct: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const { product_id } = req.body;
      if (!product_id) return res.status(400).json({ message: 'Product ID is required' });

      const id = WishlistModel.add(req.user.id, product_id);
      res.status(201).json({ success: true, added: id !== null });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  removeProduct: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      
      const product_id = parseInt(req.params.productId);
      WishlistModel.remove(req.user.id, product_id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};
