import express from 'express';
import sqlite3 from 'sqlite3';
import { feedUrls, nonFeedUrls } from '../config.js';
import { syncFeed, syncNonFeed, syncSinglePage } from '../helpers/syncFeeds.js'

const router = express.Router();
const DB_URL = process.env.DB_URL;

router.get('/sync', async (req, res) => {

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

export default router;
