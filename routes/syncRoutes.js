import express from 'express';
import sqlite3 from 'sqlite3';
import { feedUrls, nonFeedUrls } from '../configs/config.js';
import { syncFeed, syncNonFeed, syncSinglePage } from '../helpers/syncFeeds.js'

const router = express.Router();

router.get('/sync', async (req, res, next) => {

    const DB_URL = process.env.DB_URL;

    const sqlite = sqlite3.verbose();
    const db = new sqlite3.Database(DB_URL, (err) => {
      if (err) {
          console.error("Error opening the database:", err.message);
          return; // Return here instead of exiting.
      }
  });

  let feedItems = [];

  for (const feedData of feedUrls) {
    console.log(`Proecessing feedUrl (${feedData.title}) page feeds...`);
      try {
          const items = await syncFeed(feedData, db);
          feedItems.push(...items);
      } catch (error) {
          console.error("Error processing feed: " + feedData.title, error.message);
      }
  }

  for (const feedData of nonFeedUrls) {
      console.log(`Proecessing nonFeedUrl (${feedData.title}) page feeds...`);
      try {
          const items = await syncNonFeed(feedData, db);
          feedItems.push(...items);
      } catch (error) {
          console.error("Error processing non-feed: " + feedData.title, error.message);
      }
  }

  try {
    console.log("Proecessing single page feeds...");
      const singlePageItems = await syncSinglePage(db);
      feedItems.push(...singlePageItems);
  } catch (error) {
      console.error("Error processing single page feed:", error.message);
  }

  feedItems.sort((a, b) => b.date - a.date);
  res.render('index', { feedItems, feedUrls });

});

export default router;
