// External Libraries
import express from 'express';
import Parser from 'rss-parser';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import expressLayouts from 'express-ejs-layouts';
import fetch from 'node-fetch';

// Custom Modules
import { getOpenAIResponse } from './utils/openaiHandler.js';
import { getArticleLinks, getTechRadarArticleLinks, getOpenAIReleaseNotes } from './helpers/articleHelper.js';

dotenv.config();


const DEBUG = process.env.DEBUG || false;
const DB_URL = process.env.DB_URL;

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
  { url: 'https://hackernoon.com/tagged/ai/feed', title: 'HACKERNOON'},
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss', title: 'WIRED'},
  { url: 'https://www.ai.gov/feed/', title: 'NAIIO'},
  { url: 'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', title: 'MIT News'},
  { url: 'https://blogs.nvidia.com/blog/category/deep-learning/feed/', title: 'NVIDIA'},
  { url: 'https://techcommunity.microsoft.com/plugins/custom/microsoft/o365/custom-blog-rss?tid=-3314434996627025474&board=AICustomerEngineeringTeam&size=10', title:'MS: AI Customer Engineering'},
 // { url: 'https://techcommunity.microsoft.com/plugins/custom/microsoft/o365/custom-blog-rss?tid=-3314434996627025474&board=MachineLearningBlog&size=10', title: 'MS: AI Machine Learning'},
 // { url: 'https://techcommunity.microsoft.com/plugins/custom/microsoft/o365/custom-blog-rss?tid=-3314434996627025474&board=Azure-AI-Services-blog&size=10', title: 'MS: Azure AI Services'}
];

const nonFeedUrls = [

 { url: 'https://lifehacker.com/tech/ai', title: 'lifehacker'},
 { url: 'https://www.techradar.com/computing/software/artificial-intelligence', title: 'techradar'}
 
];

const singlePageUrls = [

  { url: 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes', title: 'OpenAI Releases'}
];

async function getArticles(db) {
  return new Promise(resolve => {
    db.all(`SELECT id, summary, url, title, feed_title, date FROM feed_summaries`, [], (err, rows) => {
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

const processFeedItem = async (db, item, feedData) => {
  let url = item.link;
  let articleTitle = item.title;
  let articleDate = new Date(item.pubDate || Date.now());
  let articleSummary = "";
  

  const row = await checkDatabase(db, url);

  if (row) {
      //console.log("Article exists: " + url);
      const { summary, title, date } = row;
      articleTitle = title;
      articleDate = new Date(parseInt(date));
      articleSummary = summary;
  } else {
      console.log("Fetching new article (" + item.title + ").");
      const pageResponse = await fetch(item.link);
      const pageText = await pageResponse.text();
      const $ = cheerio.load(pageText);



          //hackernoon
          if (feedData.title === 'HACKERNOON'){

            let ignoreText = 'The Noonification';
            if (item.title && !item.title.includes(ignoreText)) {
                articleSummary = await getOpenAIResponse($('main > div:first-child > :first-child:not(.exclude-class)').text());
            }
            else {
              articleSummary = false;
            }
            
        
        }
          else if(feedData.title === 'techradar'){
            articleSummary = await getOpenAIResponse($('#article-body').text());
          }
          else if(feedData.title === 'lifehacker'){
            // lifehacker
            articleSummary = await getOpenAIResponse($('main').text());
          }
          else if(feedData.title === 'OpenAI'){

            // Handle research paper abstracts
            if(url.includes('/research/')){
              articleSummary = await getOpenAIResponse($('div.container').text());
            }
            
            // Handle blog articles
            else {
              articleSummary = await getOpenAIResponse($('div#content').text());
            }
          }
          else {
            articleSummary = await getOpenAIResponse($('article').text());

          }

          if(articleSummary === false){
            console.log("ERROR on article (" + item.title + "): " + url);
            return false;//res.status(500).send(error.message);
          }

          console.log("Summary Added: " + articleSummary);
          db.run(
              `INSERT INTO feed_summaries (url, title, summary, feed_title, date) VALUES (?, ?, ?, ?, ?)`,
              [url, articleTitle, articleSummary, feedData.title, articleDate],
              (err) => {
                  if (err) throw err;
              }
          );
      //}
  }

  return {
      url,
      title: articleTitle,
      feedTitle: feedData.title,
      date: articleDate,
      summary: articleSummary
  };
};

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms));
}


async function fetchWithTimeout(url, ms = 20000) {
  try {
      const response = await Promise.race([
          fetch(url),
          timeout(ms)
      ]);
      return await response;//.text();
  } catch (error) {
      console.error("Fetch operation timed out or another error occurred:", error.message);
      return false;
  }
}

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
