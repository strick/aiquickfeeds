// initDB.mjs
import sqlite3 from 'sqlite3';

async function deleteData() {
  const sqlite = sqlite3.verbose();
  let db = new sqlite.Database('./database.db');
  db.run(`DELETE FROM feed_summaries WHERE id > '393'`, function(err) {
    if (err) {
      // Log the error message and throw the error
      console.error(err.message);
      throw err;
    }
    // Log the number of rows deleted
    console.log(`Deleted ${this.changes} row(s) successfully!`);
  });
/*
  db.run(`DELETE FROM feed_summaries WHERE title like 'OpenAI'`, function(err) {
    if (err) {
      // Log the error message and throw the error
      console.error(err.message);
      throw err;
    }
    // Log the number of rows deleted
    console.log(`Deleted ${this.changes} row(s) successfully!`);
  });

  db.all(`SELECT * FROM feed_summaries`, [], (err, rows) => {
    if (err) {
      throw err;
    }
    // `rows` is an array containing all the query results
    rows.forEach((row) => {
      console.log(row); 
    });
  });
  
*/
  db.close((err) => {
    if (err) throw err;
  });
}

deleteData();
