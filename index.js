// Imports
import express from 'express';
import Parser from 'rss-parser';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import expressLayouts from 'express-ejs-layouts';
import { getOpenAIResponse } from './utils/openaiHandler.js';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();

// App Configuration
app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

const feedUrls = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', title: 'TechCrunch' },
  { url: 'https://openai.com/blog/rss', title: 'OpenAI' },
  { url: 'https://library.educause.edu/topics/infrastructure-and-research-technologies/artificial-intelligence-ai?view=rss', title: 'EDUCAUSE' },
  //{ url: 'https://hackernoon.com/tagged/ai/feed', title: 'HACKERNOON'},
  /* { url: 'https://lifehacker.com/tech/ai', title: 'lifehacker', 
     cssSelector: 'div > div.sc-101yw2y-9 > div.sc-157agsr-0.jvChWP > main.sc-11qwj9y-1.iSAYTF > div.sc-11qwj9y-0.iMtYxk > div.sc-17uq8ex-0.fakHlO > article.sc-cw4lnv-0.ksZQxB.js_post_item[data-id][data-index][data-commerce-source] > div.sc-cw4lnv-13.hHSpAQ > div.sc-cw4lnv-10.blRKje > div.sc-cw4lnv-5.dYIPCV > a.sc-1out364-0.dPMosf.js_link[data-ga][href] > h2.sc-759qgu-0.cDAvZo.sc-cw4lnv-6.crvAWy'
   }*/
];

const nonFeedUrls = [

  { url: 'https://lifehacker.com/tech/ai', title: 'lifehacker'}
];

async function getArticles(db) {
  return new Promise(resolve => {
    db.all(`SELECT summary, url, title, feed_title, date FROM feed_summaries`, [], (err, rows) => {
      if (err) throw err;
      resolve(rows);
    });
  });
}


async function checkDatabase(db, url) {
  return new Promise(resolve => {
    db.get(`SELECT summary, url, title, feed_title, date FROM feed_summaries WHERE url = ?`, [url], (err, row) => {
      if (err) throw err;
      resolve(row);
    });
  });
}

async function handleHackerNoon(url, $, db, feedData, articleTitle, articleDate) {
  if ($('.story-title').length) {
    const articleContentDiv = $('main').nextAll('div:not([class]):first');
    if (articleContentDiv.length) {
      const articleSummary = await getOpenAIResponse(articleContentDiv.text());
      db.run(
        `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
        [url, articleTitle, articleSummary, feedData.title, articleDate],
        (err) => {
          if (err) throw err;
        }
      );
    } else {
      console.log("Skipping hackernoon article as there is no content");
      return false;
    }
  } else {
    console.log("Skipping hackernoon article as 'story-title' class doesn't exist");
    return false;
  }

  return articleSummary;
}


app.get('/', async (req, res) => {

  try {

    const sqlite = sqlite3.verbose();
    let db = new sqlite3.Database('./database.db');
    let feedItems = [];

    const rows = await getArticles(db);

    rows.forEach((row) => {
      feedItems.push({
        url: row.url,
        title: row.title,
        feedTitle: row.feed_title,
        date: new Date(parseInt(row.date)),
        summary: row.summary
      });
      
    });
      

    feedItems.sort((a, b) => b.date - a.date);
    const mergedUrls = [...feedUrls, ...nonFeedUrls];

    res.render('index', { feedItems, feedUrls: mergedUrls });

} catch (error) {
  res.status(500).send(error.message);
}

});

const processFeedItem = async (db, item, feedData) => {
  let url = item.link;
  let articleTitle = item.title;
  let articleDate = new Date(item.pubDate || Date.now());
  let articleSummary = "";
  

  const row = await checkDatabase(db, url);
  if (row) {
      console.log("Article exists: " + url);
      const { summary, title, date } = row;
      articleTitle = title;
      articleDate = new Date(parseInt(date));
      articleSummary = summary;
  } else {
      const pageResponse = await fetch(item.link);
      const pageText = await pageResponse.text();
      const $ = cheerio.load(pageText);

      if (feedData.title === 'HACKERNOON') {
          articleSummary = await handleHackerNoon(url, $, db, feedData, articleTitle, articleDate);
          if (articleSummary === false) {
              console.log("No article");
              return null;
          }
      } else {
          console.log("New article found. Asking ChatGPT for summary");
          //articleSummary = await getOpenAIResponse($('article').text());
          articleSummary = await getOpenAIResponse($('main').text());
          console.log("Summary Added: " + articleSummary);
          db.run(
              `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
              [url, articleTitle, articleSummary, feedData.title, articleDate],
              (err) => {
                  if (err) throw err;
              }
          );
      }
  }

  return {
      url,
      title: articleTitle,
      feedTitle: feedData.title,
      date: articleDate,
      summary: articleSummary
  };
};

app.get('/sync', async (req, res) => {
  try {
      const sqlite = sqlite3.verbose();
      let db = new sqlite3.Database('./database.db');
      let feedItems = [];

      for (const feedData of feedUrls) {
          console.log("New feed: " + feedData.title);
          const response = await fetch(feedData.url);
          const text = await response.text();
          const feed = await parser.parseString(text);

          for (const item of feed.items) {
              const result = await processFeedItem(db, item, feedData);
              if (result) {
                  console.log(result);
                  feedItems.push(result);
              }
          }
      }

      for (const feedData of nonFeedUrls) {
          console.log("Fetching nonfeed: " + feedData.title);
          const response = await fetch(feedData.url);
          const text = await response.text();
          //const wjsUrls = await getWSJArticleLinks(text);
          console.log("Getting article links");
          const articleUrls = await getArticleLinks(text);

          for (const item of articleUrls) {

            console.log("Fetching: " + item.link);
              const pageResponse = await fetch(item.link);
              const pageText = await pageResponse.text();
              const $ = cheerio.load(pageText);   
              
              const result = await processFeedItem(db, item, feedData);
              if (result) {
                  feedItems.push(result);
              }
            
          }
      }

      feedItems.sort((a, b) => b.date - a.date);
      res.render('index', { feedItems, feedUrls });
  } catch (error) {
      res.status(500).send(error.message);
  }
});


async function getWSJArticleLinks(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const articles = [];

  $('div.css-bdm6mo').each((index, element) => {
      const headlineLink = $(element).find('a.e1rxbks6.css-1me4f21-HeadlineLink');
      const dateElement = $(element).find('.css-cw5wgv-TimeTag'); 
      
      if (headlineLink.length) {
          let title = headlineLink.text().trim();

          if (title.includes('.css-')) {
              title = title.replace(/.*\}(.*)/, '$1').trim();
          }
          
          const link = headlineLink.attr('href');
          const pubDate = dateElement.text().trim(); // Extract the date's text content.
          articles.push({ title, link, pubDate });

      }
  });

  return articles;
}

async function getArticleLinks(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const articles = [];

  $('article.sc-cw4lnv-0').each((index, element) => {

    const headlineFigure = $(element).find('figure > a.sc-1out364-0');
//console.log(headlineFeature);      

    const link = headlineFigure.attr('href');   // Extract the article's link.


      const headlineLink = $(element).find('a.sc-1out364-0');
      //const title = headlineLink.text().trim(); // Get the title text.
      const title = $(headlineFigure).find('img').attr('alt').trim();

      console.log(title + ": " + link);
      //const link = headlineLink.attr('href');   // Extract the article's link.
      const dateElement = $(element).find('time');
      const pubDate = dateElement.attr('datetime') || dateElement.text().trim(); // Get the publication date.

      if (title && link) {
          articles.push({ title, link, pubDate });
      }
  });

  return articles;
}

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
