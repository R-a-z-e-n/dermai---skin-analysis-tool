import db from "../database";
import { createUsersTable } from "../models/user.model";
import { createProductsTable } from "../models/product.model";
import { createServicesTable } from "../models/service.model";
import { createBookingsTable } from "../models/booking.model";
import { createWishlistsTable } from "../models/wishlist.model";
import bcrypt from "bcryptjs";

// Initialize schemas
createUsersTable();
createProductsTable();
createServicesTable();
createBookingsTable();
createWishlistsTable();

// Ensure basic products are seeded
const count = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare("INSERT INTO products (name, brand, category, description, ingredients, image_url, price, rating, reviews, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  
  const seedProducts = [
    ["10% Niacinamide + Zinc Serum", "The Ordinary", "Serum", "High-strength vitamin blemish formula.", "Niacinamide, Zinc PCA", "https://picsum.photos/seed/ordinary-n/400/400", 12.90, 4.7, 10420, "Best Seller"],
    ["Hyaluronic Acid 2% + B5", "The Ordinary", "Serum", "A hydration support formula.", "Hyaluronic Acid", "https://picsum.photos/seed/ordinary-h/400/400", 10.50, 4.6, 22140, "Top Rated"],
  ];

  for (const p of seedProducts) {
    insert.run(...p);
  }
  console.log("Seeded basic products.");
}

// Add an admin user if it doesn't exist
const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
if (adminCount.count === 0) {
  const hashedPassword = bcrypt.hashSync("adminpassword", 10);
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run("Admin", "admin@example.com", hashedPassword, "admin");
  console.log("Seeded admin user.");
}

console.log("Seeding complete.");
