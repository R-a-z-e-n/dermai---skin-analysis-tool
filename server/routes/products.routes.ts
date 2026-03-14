import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', ProductsController.getAll);
router.get('/:id', ProductsController.getById);
router.post('/', authenticate, ProductsController.create);
router.put('/:id', authenticate, ProductsController.update);
router.delete('/:id', authenticate, ProductsController.delete);

export default router;
