import cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';

function getWSJArticleLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('article.jsx-adf13c9b2a104cce h2').each((index, element) => {
        // Extracting title (without date) from the current subheading.
        const titleWithDate = $(element).text().trim();
        const dateMatch = titleWithDate.match(/\(.*?\)/g);
        const pubDate = dateMatch ? dateMatch[0].replace(/\(|\)/g, '') : null;
        const title = titleWithDate.replace(/\(.*?\)/, '').trim();
  
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
            articles.push({ title, content, pubDate });
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