import cheerio from 'cheerio';

export async function getArticleLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('article.sc-cw4lnv-0').each((index, element) => {
  
        const headlineFigure = $(element).find('figure > a.sc-1out364-0');
  
        const link = headlineFigure.attr('href');   // Extract the article's link.
        const title = $(headlineFigure).find('img').attr('alt').trim();
        //console.log(title + ": " + link);
        const dateElement = $(element).find('time');
        const pubDate = dateElement.attr('datetime') || dateElement.text().trim(); // Get the publication date.
  
        if (title && link) {
            articles.push({ title, link, pubDate });
        }
    });
  
    return articles;
  }
  
export async function getTechRadarArticleLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('div.listingResult').each((index, element) => {
  
        const articleAnchor = $(element).find('a.article-link');
        const link = articleAnchor.attr('href');   // Extract the article's link.
        const title = $(articleAnchor).find('h3.article-name').text().trim(); // Extract article title
        const dateElement = $(articleAnchor).find('time');
        const pubDate = dateElement.attr('datetime') || dateElement.text().trim(); // Get the publication date.
  
        if (title && link) {
            articles.push({ title, link, pubDate });
        }
    });
  
    return articles;
}