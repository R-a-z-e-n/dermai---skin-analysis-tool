import db from "../database";

export interface Product {
  id?: number;
  name: string;
  brand: string;
  category: string;
  description: string;
  ingredients: string;
  image_url: string;
  price: number;
  rating?: number;
  reviews?: number;
  tags?: string;
}

export const createProductsTable = () => {
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
      tags TEXT DEFAULT ''
    )
  `);
};

export const ProductModel = {
  findAll: (): Product[] => {
    return db.prepare("SELECT * FROM products").all() as Product[];
  },

  findById: (id: number): Product | undefined => {
    return db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
  },

  create: (p: Product): number | bigint => {
    const stmt = db.prepare(`
      INSERT INTO products (name, brand, category, description, ingredients, image_url, price, rating, reviews, tags) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(p.name, p.brand, p.category, p.description, p.ingredients, p.image_url, p.price, p.rating || 0, p.reviews || 0, p.tags || '');
    return result.lastInsertRowid;
  },

  update: (id: number, p: Partial<Product>) => {
    const fields = Object.keys(p).map(k => `${k} = ?`).join(", ");
    if (!fields) return;
    const values = Object.values(p);
    const stmt = db.prepare(`UPDATE products SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
  }
};
