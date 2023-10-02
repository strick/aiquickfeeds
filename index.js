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
  { url: 'https://hackernoon.com/tagged/ai/feed', title: 'HACKERNOON'},
 /* { url: 'https://lifehacker.com/tech/ai', title: 'lifehacker', 
    cssSelector: 'div > div.sc-101yw2y-9 > div.sc-157agsr-0.jvChWP > main.sc-11qwj9y-1.iSAYTF > div.sc-11qwj9y-0.iMtYxk > div.sc-17uq8ex-0.fakHlO > article.sc-cw4lnv-0.ksZQxB.js_post_item[data-id][data-index][data-commerce-source] > div.sc-cw4lnv-13.hHSpAQ > div.sc-cw4lnv-10.blRKje > div.sc-cw4lnv-5.dYIPCV > a.sc-1out364-0.dPMosf.js_link[data-ga][href] > h2.sc-759qgu-0.cDAvZo.sc-cw4lnv-6.crvAWy'
  }*/
];

app.get('/', async (req, res) => {
  try {

    const fetch = (await import('node-fetch')).default;
    const sqlite = sqlite3.verbose();
    let db = new sqlite3.Database('./database.db');

    let feedItems = [];

    for (const feedData of feedUrls) {
      console.log("Reading feed: " + feedData.url);
      const response = await fetch(feedData.url);
      const text = await response.text();
      const feed = await parser.parseString(text);

      for (const item of feed.items) {

        let url = item.link;
        let articleTitle = item.title;
        let articleSummary = "";
        let articleDate = new Date(item.pubDate || Date.now()); // Added date here

        console.log("Checking database");
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
          console.log("No recored, creating new one");
          const pageResponse = await fetch(item.link);
          const pageText = await pageResponse.text();
          const $ = cheerio.load(pageText);


          if (feedData.title === 'HACKERNOON') {
            console.log("hacker noon one");
            // Special logic for HACKERNOON
            if ($('.story-title').length) {

                // Find the first div without a class after story-title
              const articleContentDiv = $('main').nextAll('div:not([class]):first');
              if (articleContentDiv.length) {

                  articleSummary = await getOpenAIResponse(articleContentDiv.text());

                  db.run(
                    `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
                    [url, articleTitle, articleSummary, feedData.title, articleDate],
                    (err) => {
                        if (err) throw err;
                    }
                );

              }
              else {
                // Skip the article if "story-title" class doesn't exist
                console.log("Skipping hackernoon article as there is no content");
                continue;
              }

            } else {
                // Skip the article if "story-title" class doesn't exist
                console.log("Skipping hackernoon article as 'story-title' class doesn't exist");
                continue;
            }
          } else {

            //console.log($('article').text());
            console.log("ASking Open AI");
            articleSummary = await getOpenAIResponse($('article').text());

            console.log("Inserting: " + articleTitle);
            db.run(
              `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
              [url, articleTitle, articleSummary, feedData.title, articleDate],
              (err) => {
                if (err) throw err;
              }
            );
          }
        }

        console.log("Updating the feed with one: " + articleTitle);
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
