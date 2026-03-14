import { Router } from 'express';
import { WishlistsController } from '../controllers/wishlists.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Protect all wishlist routes
router.use(authenticate);

router.get('/', WishlistsController.getUserWishlist);
router.post('/', WishlistsController.addProduct);
router.delete('/:productId', WishlistsController.removeProduct);

export default router;
