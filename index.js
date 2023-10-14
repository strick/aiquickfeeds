// External Libraries
import express from 'express';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import expressLayouts from 'express-ejs-layouts';

// Custom Modules
import { getArticles } from './database.js';
import { feedUrls, nonFeedUrls, singlePageUrls } from './config.js';
import { syncFeed, syncNonFeed, syncSinglePage } from './helpers/syncFeeds.js'
import { sortFeedItems, sortMergedUrls } from './helpers/sortFeeds.js'

dotenv.config();

//app.locals.debug = process.env.DEBUG || false;
const DB_URL = process.env.DB_URL;
const PORT = process.env.PORT || 3000;

const app = express();

// App Configuration
app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  try {
      const sqlite = sqlite3.verbose();
      const db = await new sqlite3.Database(DB_URL, (err) => {
          if (err) {
              console.log(DB_URL);
              console.error("Error opening the database:", err.message);
              return; // Return here instead of exiting.
          }
      });

      const rows = await getArticles(db);
      const feedItems = rows.map(row => ({
          url: row.url,
          title: row.title,
          feedTitle: row.feed_title,
          date: new Date(parseInt(row.date)),
          summary: row.summary,
          id: row.id
      })).sort(sortFeedItems);

      const mergedUrls = [...feedUrls, ...nonFeedUrls, ...singlePageUrls].sort(sortMergedUrls);

      res.render('index', { feedItems, feedUrls: mergedUrls });
  } catch (error) {
      res.status(500).send(error.message);
  }
});

app.get('/sync', async (req, res) => {
  const sqlite = sqlite3.verbose();
  const db = new sqlite3.Database(DB_URL, (err) => {
      if (err) {
          console.error("Error opening the database:", err.message);
          return; // Return here instead of exiting.
      }
  });

  let feedItems = [];

  for (const feedData of feedUrls) {
      try {
          const items = await syncFeed(feedData, db);
          feedItems.push(...items);
      } catch (error) {
          console.error("Error processing feed: " + feedData.title, error.message);
      }
  }

  for (const feedData of nonFeedUrls) {
      try {
          const items = await syncNonFeed(feedData, db);
          feedItems.push(...items);
      } catch (error) {
          console.error("Error processing non-feed: " + feedData.title, error.message);
      }
  }

  try {
      const singlePageItems = await syncSinglePage(db);
      feedItems.push(...singlePageItems);
  } catch (error) {
      console.error("Error processing single page feed:", error.message);
  }

  feedItems.sort((a, b) => b.date - a.date);
  res.render('index', { feedItems, feedUrls });

});


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
