import cheerio from 'cheerio';
import fetch from 'node-fetch';

import { getOpenAIResponse } from '../utils/openaiHandler.js';
import { checkDatabase } from '../database.js';

export async function processFeedItem(db, item, feedData) {
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
  
  
  export async function fetchWithTimeout(url, ms = 20000) {
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