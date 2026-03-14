import db from "../database";
import { createUsersTable } from "../models/user.model";
import { createProductsTable } from "../models/product.model";
import { createServicesTable } from "../models/service.model";
import { createBookingsTable } from "../models/booking.model";
import { createWishlistsTable } from "../models/wishlist.model";

// Drop all tables for a clean slate in testing
try {
  db.exec(`
    DROP TABLE IF EXISTS wishlists;
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS services;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;
  `);
} catch (e) {
  console.error("Error dropping tables", e);
}

// Recreate them
createUsersTable();
createProductsTable();
createServicesTable();
createBookingsTable();
createWishlistsTable();

console.log("Test database initialized successfully.");
