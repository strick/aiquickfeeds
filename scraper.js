import cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';

function getWSJArticleLinks(htmlContent) {
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
            const date = dateElement.text().trim(); // Extract the date's text content.
            articles.push({ title, link, date });

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