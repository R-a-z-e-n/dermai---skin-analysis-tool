import db from "../database";

export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role?: string;
  created_at?: string;
}

export const createUsersTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

export const UserModel = {
  create: (user: User): number | bigint => {
    const stmt = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
    const result = stmt.run(user.name, user.email, user.password, user.role || 'user');
    return result.lastInsertRowid;
  },
  
  findByEmail: (email: string): User | undefined => {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
    if (user) {
      delete user.password;
    }
    return user;
  }
};
