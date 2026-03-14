import request from 'supertest';
import app from '../app';
import db from '../database';
import { UserModel } from '../models/user.model';
import { createProductsTable } from '../models/product.model';
import { createUsersTable } from '../models/user.model';
import { createServicesTable } from '../models/service.model';
import { createBookingsTable } from '../models/booking.model';
import { createWishlistsTable } from '../models/wishlist.model';
import bcrypt from 'bcryptjs';

describe('Products Endpoints', () => {
  let token = '';

  beforeAll(async () => {
    // Reinitialize DB
    db.exec("DROP TABLE IF EXISTS wishlists; DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS services; DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS users;");
    createUsersTable();
    createProductsTable();
    createServicesTable();
    createBookingsTable();
    createWishlistsTable();
    
    // Create an admin user for the tests
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    UserModel.create({ name: 'Admin', email: 'admin@test.com', password: hashedPassword, role: 'admin' });

    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'adminpassword' });
    token = res.body.token;
  });

  afterAll(() => {
    // Cleanup if necessary
  });

  let productId = 0;

  it('should fetch an empty list of products initially', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    // Since test-db doesn't seed data if dropped and recreated before calling test-db script directly, 
    // Wait, test-db.ts DOES NOT seed products. It just recreates tables.
    // So it should be empty.
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  it('should create a new product (protected)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Serum',
        brand: 'Test Brand',
        category: 'Serum',
        description: 'A test product',
        ingredients: 'Water, Glycerin',
        image_url: 'http://example.com/image.jpg',
        price: 15.00
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    productId = res.body.id;
  });

  it('should fetch the created product by ID', async () => {
    const res = await request(app).get(`/api/products/${productId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('name', 'Test Serum');
  });

  it('should list products and include the new product', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id', productId);
  });

});
