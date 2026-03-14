import db from "../database";

export interface Service {
  id?: number;
  title: string;
  description: string;
  duration_minutes: number;
  price: number;
  image_url?: string;
}

export const createServicesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price REAL NOT NULL,
      image_url TEXT
    )
  `);
};

export const ServiceModel = {
  findAll: (): Service[] => {
    return db.prepare("SELECT * FROM services").all() as Service[];
  },

  findById: (id: number): Service | undefined => {
    return db.prepare("SELECT * FROM services WHERE id = ?").get(id) as Service | undefined;
  },

  create: (s: Service): number | bigint => {
    const stmt = db.prepare(`
      INSERT INTO services (title, description, duration_minutes, price, image_url) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(s.title, s.description, s.duration_minutes, s.price, s.image_url || null);
    return result.lastInsertRowid;
  }
};
