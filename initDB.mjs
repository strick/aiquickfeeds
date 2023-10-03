// initDB.mjs
import sqlite3 from 'sqlite3';

async function initDB() {
  const sqlite = sqlite3.verbose();
  let db = new sqlite.Database('./database.db');
/*
  db.run(`DROP TABLE IF EXISTS feed_summaries`, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    }
    console.log("Table deleted successfully!");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS feed_summaries (
      url TEXT PRIMARY KEY,
      feed_title TEXT,
      title TEXT,
      summary TEXT,
      date TEXT
    )
  `, [], (err) => {
    if (err) throw err;
  });

  db.close((err) => {
    if (err) throw err;
  });
  */
}

initDB();
