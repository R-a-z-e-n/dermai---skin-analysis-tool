import db from "../database";

export interface Booking {
  id?: number;
  user_id: number;
  service_id: number;
  date: string;
  status?: "pending" | "confirmed" | "cancelled";
  created_at?: string;
}

export const createBookingsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      date DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (service_id) REFERENCES services (id)
    )
  `);
};

export const BookingModel = {
  findByUserId: (userId: number): Booking[] => {
    return db.prepare(`
      SELECT b.*, s.title as service_title, s.price as service_price 
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.user_id = ?
      ORDER BY b.date DESC
    `).all(userId) as Booking[];
  },

  create: (b: Booking): number | bigint => {
    const stmt = db.prepare("INSERT INTO bookings (user_id, service_id, date, status) VALUES (?, ?, ?, ?)");
    const result = stmt.run(b.user_id, b.service_id, b.date, b.status || 'pending');
    return result.lastInsertRowid;
  },

  updateStatus: (id: number, status: string) => {
    db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);
  }
};
