import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("skincare.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    ingredients TEXT,
    image_url TEXT,
    price REAL DEFAULT 0,
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    tags TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skin_type TEXT,
    summary TEXT,
    insight TEXT,
    conditions TEXT,
    ingredients TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )
`);

// Ensure columns exist if table was created before schema update
const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
const columns = tableInfo.map(c => c.name);

if (!columns.includes('price')) db.exec("ALTER TABLE products ADD COLUMN price REAL DEFAULT 0");
if (!columns.includes('rating')) db.exec("ALTER TABLE products ADD COLUMN rating REAL DEFAULT 0");
if (!columns.includes('reviews')) db.exec("ALTER TABLE products ADD COLUMN reviews INTEGER DEFAULT 0");
if (!columns.includes('tags')) db.exec("ALTER TABLE products ADD COLUMN tags TEXT DEFAULT ''");

// Seed data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare("INSERT INTO products (name, brand, category, description, ingredients, image_url, price, rating, reviews, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  
  const seedProducts = [
    ["10% Niacinamide + Zinc Serum", "The Ordinary", "Serum", "High-strength vitamin and mineral blemish formula.", "Niacinamide, Zinc PCA", "https://picsum.photos/seed/ordinary-n/400/400", 12.90, 4.7, 10420, "Best Seller, Oil Control"],
    ["Hyaluronic Acid 2% + B5", "The Ordinary", "Serum", "A hydration support formula with ultra-pure, vegan hyaluronic acid.", "Hyaluronic Acid, Vitamin B5", "https://picsum.photos/seed/ordinary-h/400/400", 10.50, 4.6, 22140, "Top Rated, Hydration"],
    ["Ceramide Barrier Moisturizer", "CeraVe", "Moisturizer", "Restores the protective skin barrier with essential ceramides.", "Ceramides, Hyaluronic Acid, Niacinamide", "https://picsum.photos/seed/cerave-m/400/400", 18.99, 4.8, 15300, "Minimalist, Editor's Pick"],
    ["2% BHA Liquid Exfoliant", "Paula's Choice", "Exfoliant", "Unclogs pores, smooths wrinkles, and evens skin tone.", "Salicylic Acid, Green Tea Extract", "https://picsum.photos/seed/paula-bha/400/400", 34.00, 4.8, 12890, "Cult Favorite"],
    ["Centella Calming Essence", "Some By Mi", "Essence", "Soothes irritated skin and strengthens the skin barrier.", "Centella Asiatica, Tranexamic Acid", "https://picsum.photos/seed/somebymi/400/400", 22.00, 4.5, 8740, "Soothing"],
    ["Mineral SPF 50 Daily Sunscreen", "EltaMD", "Sunscreen", "Broad-spectrum protection for sensitive and acne-prone skin.", "Zinc Oxide, Niacinamide", "https://picsum.photos/seed/eltamd/400/400", 39.00, 4.9, 5230, "Derm Recommended"],
    ["Gentle Foaming Cleanser", "La Roche-Posay", "Cleanser", "Removes impurities while maintaining skin's natural pH.", "Ceramides, Glycerin", "https://picsum.photos/seed/laroche-c/400/400", 16.50, 4.6, 15230, "Gentle"],
    ["Advanced Retinoid 2%", "The Ordinary", "Treatment", "Reduces the appearance of fine lines and general skin aging.", "Retinoid, Squalane", "https://picsum.photos/seed/ordinary-r/400/400", 11.80, 4.4, 7220, "Anti-Aging"]
  ];

  for (const p of seedProducts) {
    insert.run(...p);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, brand, category, description, ingredients, image_url, price, rating, reviews, tags } = req.body;
    const insert = db.prepare("INSERT INTO products (name, brand, category, description, ingredients, image_url, price, rating, reviews, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const result = insert.run(name, brand, category, description, ingredients, image_url, price, rating, reviews, tags);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const { name, brand, category, description, ingredients, image_url, price, rating, reviews, tags } = req.body;
    const update = db.prepare(`
      UPDATE products 
      SET name = ?, brand = ?, category = ?, description = ?, ingredients = ?, 
          image_url = ?, price = ?, rating = ?, reviews = ?, tags = ?
      WHERE id = ?
    `);
    update.run(name, brand, category, description, ingredients, image_url, price, rating, reviews, tags, id);
    res.json({ success: true });
  });

  app.get("/api/products/:id/reviews", (req, res) => {
    const { id } = req.params;
    const reviews = db.prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC").all(id);
    res.json(reviews);
  });

  app.post("/api/reviews", (req, res) => {
    const { productId, userName, rating, comment } = req.body;
    
    // Insert review
    const insertReview = db.prepare("INSERT INTO reviews (product_id, user_name, rating, comment) VALUES (?, ?, ?, ?)");
    insertReview.run(productId, userName, rating, comment);

    // Update product average rating and count
    const stats = db.prepare("SELECT COUNT(*) as count, AVG(rating) as avgRating FROM reviews WHERE product_id = ?").get(productId) as { count: number, avgRating: number };
    
    const updateProduct = db.prepare("UPDATE products SET rating = ?, reviews = ? WHERE id = ?");
    updateProduct.run(stats.avgRating.toFixed(1), stats.count, productId);

    res.json({ success: true, newRating: stats.avgRating.toFixed(1), newReviews: stats.count });
  });

  app.get("/api/history/:userId", (req, res) => {
    const { userId } = req.params;
    const history = db.prepare("SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(history);
  });

  app.post("/api/history", (req, res) => {
    const { userId, skinType, summary, insight, conditions, ingredients, imageUrl } = req.body;
    const insert = db.prepare("INSERT INTO analysis_history (user_id, skin_type, summary, insight, conditions, ingredients, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const result = insert.run(userId, skinType, summary, insight, JSON.stringify(conditions), JSON.stringify(ingredients), imageUrl);
    res.json({ id: result.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
