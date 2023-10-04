// initDB.mjs
import sqlite3 from 'sqlite3';
async function initDB() {
  const sqlite = sqlite3.verbose();
  let db = new sqlite.Database('./database.db');

  // Step 1: Rename the old table
  /*db.run(`ALTER TABLE feed_summaries RENAME TO temp_feed_summaries;`, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    }
    console.log("Old table renamed successfully!");
  });

  // Step 2: Create new table with desired schema
  db.run(`
    CREATE TABLE IF NOT EXISTS feed_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      feed_title TEXT,
      title TEXT,
      summary TEXT,
      date TEXT
    )
  `, [], (err) => {
    if (err) throw err;
    console.log("New table created successfully!");
  });

  // Step 3: Copy data from old table to new table
  db.run(`
    INSERT INTO feed_summaries (url, feed_title, title, summary, date)
    SELECT url, feed_title, title, summary, date FROM temp_feed_summaries
  `, [], (err) => {
    if (err) throw err;
    console.log("Data copied successfully!");
  });

  // Step 4: Drop the old table
  db.run(`DROP TABLE temp_feed_summaries`, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    }
    console.log("Old table dropped successfully!");
  });

  db.close((err) => {
    if (err) throw err;
  });
  */
}

initDB();
