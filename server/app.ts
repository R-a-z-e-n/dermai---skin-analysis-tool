import express from 'express';
import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import servicesRoutes from './routes/services.routes';
import bookingsRoutes from './routes/bookings.routes';
import wishlistsRoutes from './routes/wishlists.routes';

const app = express();
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/wishlist', wishlistsRoutes);

export default app;
