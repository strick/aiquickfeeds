// External Libraries
import express from 'express';
import Parser from 'rss-parser';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import expressLayouts from 'express-ejs-layouts';

// Custom Modules
import { getOpenAIResponse } from './utils/openaiHandler.js';
import { getArticleLinks, getTechRadarArticleLinks, getOpenAIReleaseNotes } from './helpers/articleHelper.js';
import { getArticles, checkDatabase } from './database.js';
import { processFeedItem, fetchWithTimeout } from './feedProcessor.js';
import { feedUrls, nonFeedUrls, singlePageUrls } from './config.js';

dotenv.config();


const DEBUG = process.env.DEBUG || false;
const DB_URL = process.env.DB_URL;
const PORT = process.env.PORT || 3000;


const app = express();
const parser = new Parser();

// App Configuration
app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {

  try {

    const sqlite = sqlite3.verbose();
    let db = await new sqlite3.Database(DB_URL, (err) => {
      if (err) {

          console.log(DB_URL)
          console.error("Error opening the database:", err.message);
          // Handle the error as needed, e.g., exit the process or retry.
          process.exit(1); // Exits the process. You can choose other ways to handle the error.
      }
    });

    let feedItems = [];

    const rows = await getArticles(db);

    rows.forEach((row) => {
      feedItems.push({
        url: row.url,
        title: row.title,
        feedTitle: row.feed_title,
        date: new Date(parseInt(row.date)),
        summary: row.summary,
        id: row.id
      });
      
    });
      

    feedItems.sort((a, b) => {
      let dateA = new Date(a.date);
      let dateB = new Date(b.date);

    // Remove the time part from the dates for comparison
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);

    // Primary sort by date (month, day, year only)
    if (dateA < dateB) return 1;
    if (dateA > dateB) return -1;

    return b.id - a.id;
  });
  
    const mergedUrls = [...feedUrls, ...nonFeedUrls, ...singlePageUrls];
    mergedUrls.sort((a, b) => {
      const titleA = a.title.toLowerCase().split(' ').join('-');
      const titleB = b.title.toLowerCase().split(' ').join('-');
  
      return titleA.localeCompare(titleB);
    });

    res.render('index', { feedItems, feedUrls: mergedUrls });

} catch (error) {
  res.status(500).send(error.message);
}

});



app.get('/sync', async (req, res) => {
  try {
      const sqlite = sqlite3.verbose();
      let db = new sqlite3.Database(DB_URL, (err) => {
        if (err) {

            console.log(DB_URL)
            console.error("Error opening the database:", err.message);
            // Handle the error as needed, e.g., exit the process or retry.
            process.exit(1); // Exits the process. You can choose other ways to handle the error.
        }
      });
      let feedItems = [];

      for (const feedData of feedUrls) {
        if(DEBUG) console.log("Fetching RSS feed: " + feedData.title);
          //const response = await fetch(feedData.url);
          const response = await fetchWithTimeout(feedData.url);
          if(response === false) continue;
          const text = await response.text();
          if(DEBUG) console.log("Parsing feed");
          try {
            const feed = await parser.parseString(text);
            if(DEBUG) console.log("Done parsing");
            for (const item of feed.items) {
                const result = await processFeedItem(db, item, feedData);
                if (result) {
                    //console.log(result);
                    feedItems.push(result);
                }
            }
          }
          catch(err){
            console.error("Error parsing feed: " + feedData.url, err.message);
          }
      }

      for (const feedData of nonFeedUrls) {
        if(DEBUG) console.log("Fetching nonfeed: " + feedData.title);
          //const response = await fetch(feedData.url);
          const response = await fetchWithTimeout(feedData.url);
          if(response === false) continue;
          const text = await response.text();
          //const wjsUrls = await getWSJArticleLinks(text);
          if(DEBUG) console.log("Getting article links");

          let articleUrls = null;

          if(feedData.title === 'techradar'){
            if(DEBUG) console.log("Getting techrader artcles");
            articleUrls = await getTechRadarArticleLinks(text);
          }
          else {
            if(DEBUG) console.log("Getting article");
            articleUrls = await getArticleLinks(text);
          }

          for (const item of articleUrls) {

            if(DEBUG) console.log("Fetching: " + item.link);
              //const pageResponse = await fetch(item.link);
              const pageResponse = await fetchWithTimeout(feedData.url);
              if(pageResponse === false) continue;
              const pageText = await pageResponse.text();
              const $ = cheerio.load(pageText);   
              
              const result = await processFeedItem(db, item, feedData);
              if (result) {
                  feedItems.push(result);
              }
            
          }
      }

      if(DEBUG) console.log("handling single page feeds");
      // Handle single page feeds
      //const response = await fetch('https://help.openai.com/en/articles/6825453-chatgpt-release-notes');
      const response = await fetchWithTimeout('https://help.openai.com/en/articles/6825453-chatgpt-release-notes');
      if(response !== false) {
      const text = await response.text();
      
      const singlePageItems = await getOpenAIReleaseNotes(text);

      for(const page of singlePageItems){

        let articleSummary = '';
        let url = page.url;
        let articleTitle = page.title;
        let articleDate = new Date(page.pubDate || Date.now());

        if(DEBUG) console.log(url);
        const row = await checkDatabase(db, url);
        if (row) {
          if(DEBUG) console.log("Single page article exists: " + url);
            const { summary, title, date } = row;
            articleTitle = title;
            articleDate = new Date(parseInt(date));
            articleSummary = summary;
        } else {
          articleSummary = await getOpenAIResponse(page.content);

          if(articleSummary === false){
            continue;//res.status(500).send(error.message);
          }
          
          console.log("Fetching new article (" + articleTitle + ").");

          console.log("Summary Added: " + articleSummary);
          db.run(
              `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
              [url, articleTitle, articleSummary, 'OpenAI Releases', articleDate],
              (err) => {
                  if (err) throw err;
              }
          );         
          feedItems.push({
            url,
            title: articleTitle,
            feedTitle: 'OpenAI Releases',
            date: articleDate,
            summary: articleSummary
          });
        }        
      }
    }

      feedItems.sort((a, b) => b.date - a.date);
      if(DEBUG) console.log("Done syncing");
      res.render('index', { feedItems, feedUrls });
  } catch (error) {
      res.status(500).send(error.message);
  }
});




app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
