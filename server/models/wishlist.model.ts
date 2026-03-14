import db from "../database";

export interface Wishlist {
  id?: number;
  user_id: number;
  product_id: number;
  created_at?: string;
}

export const createWishlistsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `);
};

export const WishlistModel = {
  findByUserId: (userId: number): any[] => {
    return db.prepare(`
      SELECT w.id as wishlist_id, p.* 
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).all(userId) as any[];
  },

  add: (userId: number, productId: number): number | bigint | null => {
    try {
      const stmt = db.prepare("INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)");
      const result = stmt.run(userId, productId);
      return result.lastInsertRowid;
    } catch (e: any) {
      // Ignored if duplicate
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
      throw e;
    }
  },

  remove: (userId: number, productId: number) => {
    db.prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?").run(userId, productId);
  }
};
