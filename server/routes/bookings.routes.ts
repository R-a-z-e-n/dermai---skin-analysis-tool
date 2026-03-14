import { Router } from 'express';
import { BookingsController } from '../controllers/bookings.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Protect all booking routes
router.use(authenticate);

router.get('/', BookingsController.getUserBookings);
router.post('/', BookingsController.create);
router.put('/:id/status', BookingsController.updateStatus);

export default router;
