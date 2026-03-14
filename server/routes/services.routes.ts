import { Router } from 'express';
import { ServicesController } from '../controllers/services.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', ServicesController.getAll);
router.get('/:id', ServicesController.getById);
router.post('/', authenticate, ServicesController.create);

export default router;
