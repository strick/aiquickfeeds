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
  { url: 'https://hackernoon.com/tagged/ai/feed', title: 'HACKERNOON'},
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss', title: 'WIRED'},
  //{ url: 'https://feeds.feedburner.com/blogspot/gJZg', title: 'Google Research'}
];

const nonFeedUrls = [

 { url: 'https://lifehacker.com/tech/ai', title: 'lifehacker'},
 
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

async function handleHackerNoon(url, $, db, feedData, articleTitle, articleDate) {
  if ($('.story-title').length) {
    const articleContentDiv = $('main').nextAll('div:not([class]):first');
    if (articleContentDiv.length) {
      //const articleSummary = await getOpenAIResponse(articleContentDiv.text());
      articleSummary = await getOpenAIResponse($('main > div:first-child > :first-child:not(.exclude-class)').text());
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
        title: row.title + " " + row.id,
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
      console.log("Article exists: " + url);
      const { summary, title, date } = row;
      articleTitle = title;
      articleDate = new Date(parseInt(date));
      articleSummary = summary;
  } else {
      const pageResponse = await fetch(item.link);
      const pageText = await pageResponse.text();
      const $ = cheerio.load(pageText);

          console.log("New article found (" + item.title + "). Asking ChatGPT for summary");
          //default
          //articleSummary = await getOpenAIResponse($('article').text());
          // need to hander based on each.

          //hackernoon
          if (feedData.title === 'HACKERNOON'){

            let ignoreText = 'The Noonification';
            if (!articleTitle.includes(ignoreText)) {
              articleSummary = await getOpenAIResponse($('main > div:first-child > :first-child:not(.exclude-class)').text());
            }

          }
          else if(feedData.title === 'lifehacker'){
            // lifehacker
            articleSummary = await getOpenAIResponse($('main').text());
          }
          else {
            articleSummary = await getOpenAIResponse($('article').text());

          }

          if(articleSummary === false){
            console.log("ERROR on article: " + url);
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

app.get('/sync', async (req, res) => {
  try {
      const sqlite = sqlite3.verbose();
      let db = new sqlite3.Database('./database.db');
      let feedItems = [];

      for (const feedData of feedUrls) {
          console.log("RSS feed: " + feedData.title);
          const response = await fetch(feedData.url);
          const text = await response.text();
          const feed = await parser.parseString(text);

          for (const item of feed.items) {
              const result = await processFeedItem(db, item, feedData);
              if (result) {
                  //console.log(result);
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

          let articleUrls = null;

          
          articleUrls = await getArticleLinks(text);

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

      console.log("handling single page feeds");
      // Handle single page feeds
      const response = await fetch('https://help.openai.com/en/articles/6825453-chatgpt-release-notes');
      const text = await response.text();
      const singlePageItems = await getOpenAIReleaseNotes(text);

      for(const page of singlePageItems){

        let articleSummary = '';
        let url = page.url;
        let articleTitle = page.title;
        let articleDate = new Date(page.pubDate || Date.now());

        console.log(url);
        const row = await checkDatabase(db, url);
        if (row) {
            console.log("Single page article exists: " + url);
            const { summary, title, date } = row;
            articleTitle = title;
            articleDate = new Date(parseInt(date));
            articleSummary = summary;
        } else {
          articleSummary = await getOpenAIResponse(page.content);

          if(articleSummary === false){
            continue;//res.status(500).send(error.message);
          }
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

async function getOpenAIReleaseNotes(htmlContent){
  const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('article.jsx-adf13c9b2a104cce h2').each((index, element) => {
      // Extracting title (without date) from the current subheading.
      const titleWithDate = $(element).text().trim();
      const dateMatch = titleWithDate.match(/\(.*?\)/g);
      const pubDate = dateMatch ? dateMatch[0].replace(/\(|\)/g, '') : null;
      const title = titleWithDate.replace(/\(.*?\)/, '').trim();
      const url = 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes#' + $(element).attr('id');

       // Extract content text following the title.
      let content = "";
      let nextElem = $(element).parent().next();
      while(nextElem.length && !nextElem.find('h2').length) {
          if(nextElem.text().trim()) {
              content += nextElem.text().trim() + "\n";
          }
          nextElem = nextElem.next();
      }


      if (title && content) {
          articles.push({ title, content, pubDate, url });
      }
  }); 
  
    return articles;
}

async function getArticleLinks(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const articles = [];

  $('article.sc-cw4lnv-0').each((index, element) => {

      const headlineFigure = $(element).find('figure > a.sc-1out364-0');

      const link = headlineFigure.attr('href');   // Extract the article's link.
      const title = $(headlineFigure).find('img').attr('alt').trim();
      console.log(title + ": " + link);
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
