import express from 'express';
import sqlite3 from 'sqlite3';
import { getArticles } from '../database/database.js';
import { feedUrls, nonFeedUrls, singlePageUrls } from '../configs/config.js';
import { sortFeedItems, sortMergedUrls } from '../helpers/sortFeeds.js'

const router = express.Router();

router.get('/', async (req, res, next) => {
  
    const DB_URL = process.env.DB_URL;

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
        next(error);
    }

});

export default router;
