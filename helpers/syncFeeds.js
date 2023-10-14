import Parser from 'rss-parser';

import { getOpenAIResponse } from '../utils/openaiHandler.js';
import { getArticleLinks, getTechRadarArticleLinks, getOpenAIReleaseNotes } from './articleHelper.js';
import { processFeedItem, fetchWithTimeout } from './feedProcessor.js';
import { checkDatabase } from '../database/database.js';

export async function syncFeed(feedData, db){

    const parser = new Parser();
    const feedItems = [];
    const response = await fetchWithTimeout(feedData.url);
    if (!response) return [];
    const text = await response.text();
    
    const feed = await parser.parseString(text);
    for (const item of feed.items) {
        const result = await processFeedItem(db, item, feedData);
        if (result) {
            feedItems.push(result);
        }
    }
    return feedItems;
};

export async function syncNonFeed(feedData, db){
    const feedItems = [];
    const response = await fetchWithTimeout(feedData.url);
    if (!response) return [];

    const text = await response.text();
    let articleUrls = feedData.title === 'techradar' ? await getTechRadarArticleLinks(text) : await getArticleLinks(text);
    
    for (const item of articleUrls) {
        const pageResponse = await fetchWithTimeout(item.link);
        if (!pageResponse) continue;
        const pageText = await pageResponse.text();

        const result = await processFeedItem(db, item, feedData);
        if (result) {
            feedItems.push(result);
        }
    }
    return feedItems;
};

export async function syncSinglePage(db){
    const feedItems = [];
    const response = await fetchWithTimeout('https://help.openai.com/en/articles/6825453-chatgpt-release-notes');
    if (!response) return [];
    
    const text = await response.text();
    const singlePageItems = await getOpenAIReleaseNotes(text);

    for (const page of singlePageItems) {
        let articleSummary = '';
        let url = page.url;
        let articleTitle = page.title;
        let articleDate = new Date(page.pubDate || Date.now());

        //if (DEBUG) console.log(url);
        const row = await checkDatabase(db, url);
        if (row) {
            //if (DEBUG) console.log("Single page article exists: " + url);
            const { summary, title, date } = row;
            articleTitle = title;
            articleDate = new Date(parseInt(date));
            articleSummary = summary;
        } else {
            articleSummary = await getOpenAIResponse(page.content);
            if (articleSummary === false) {
                continue; // If failed to get summary, skip to the next item
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
        }

        feedItems.push({
            url,
            title: articleTitle,
            feedTitle: 'OpenAI Releases',
            date: articleDate,
            summary: articleSummary
        });
    }

    return feedItems;
};
