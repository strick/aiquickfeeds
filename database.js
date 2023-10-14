export async function getArticles(db) {
    return new Promise(resolve => {
      db.all(`SELECT id, summary, url, title, feed_title, date FROM feed_summaries`, [], (err, rows) => {
        if (err) throw err;
        resolve(rows);
      });
    });
  }
  
  
  export async function checkDatabase(db, url) {
    return new Promise(resolve => {
      db.get(`SELECT summary, url, title, feed_title, date FROM feed_summaries WHERE url = ?`, [url], (err, row) => {
        if (err) throw err;
        resolve(row);
      });
    });
  }