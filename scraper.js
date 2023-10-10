import cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';

function getWSJArticleLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('div.listingResult').each((index, element) => {
  
        const articleAnchor = $(element).find('a.article-link');
        const link = articleAnchor.attr('href');   // Extract the article's link.
        const title = $(articleAnchor).find('h3.article-name').text().trim(); // Extract article title
        //console.log(title + ": " + link);
        const dateElement = $(articleAnchor).find('time');
        const pubDate = dateElement.attr('datetime') || dateElement.text().trim(); // Get the publication date.
  
        if (title && link) {
            articles.push({ title, link, pubDate });
        }
    });
  
    return articles;
}

// Sample HTML content

//const response = await fetch('https://aiquickfeeds.com/');
//const text = await response.text();




fs.readFile('tmp', 'utf8', (err, htmlContent) => {
    if (err) {
        console.error("Failed to read file", err);
        return;
    }
    //const htmlContent = text; // Replace ... with your actual HTML content

    console.log(getWSJArticleLinks(htmlContent));
});