// index.mjs
import express from 'express';
import Parser from 'rss-parser';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import expressLayouts from 'express-ejs-layouts';

dotenv.config();

import { getOpenAIResponse } from './utils/openaiHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');

// Use express-ejs-layouts middleware
app.use(expressLayouts);

const parser = new Parser();

// Array of RSS feed URLs
const feedUrls = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', title: 'TechCrunch' },
  { url: 'https://openai.com/blog/rss', title: 'OpenAI' },
  { url: 'https://library.educause.edu/topics/infrastructure-and-research-technologies/artificial-intelligence-ai?view=rss', title: 'EDUCAUSE'},
  { url: 'https://hackernoon.com/tagged/ai/feed', title: 'HACKERNOON'}
];

app.get('/', async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const sqlite = sqlite3.verbose();
    let db = new sqlite3.Database('./database.db');

    let feedItems = [];

    for (const feedData of feedUrls) {
      const response = await fetch(feedData.url);
      const text = await response.text();
      const feed = await parser.parseString(text);

      for (const item of feed.items) {
        let url = item.link;
        let articleTitle = item.title;
        let articleSummary = "";
        let articleDate = new Date(item.pubDate || Date.now()); // Added date here

        const row = await new Promise(resolve => {
          db.get(`SELECT summary, url, title, feed_title, date FROM feed_summaries WHERE url = ?`, [url], (err, row) => {
            if (err) throw err;
            resolve(row);
          });
        });

        if (row) {
          articleSummary = row.summary;
          articleTitle = row.title;
          articleDate = new Date(parseInt(row.date)); // Assign date from database
        } else {
          const pageResponse = await fetch(item.link);
          const pageText = await pageResponse.text();
          const $ = cheerio.load(pageText);
          articleSummary = await getOpenAIResponse($('article').text());

          db.run(
            `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
            [url, articleTitle, articleSummary, feedData.title, articleDate],
            (err) => {
              if (err) throw err;
            }
          );
        }

        feedItems.push({
          url: url,
          title: articleTitle,
          summary: articleSummary,
          feedTitle: feedData.title,
          date: articleDate // include the date here
        });
      }
    }

    // sort feedItems by date in descending order
    feedItems.sort((a, b) => b.date - a.date);

    // render the EJS template and pass the feedItems
    res.render('index', { feedItems, feedUrls });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
