import cheerio from 'cheerio';

export async function getArticleLinks(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
  
    $('article.sc-cw4lnv-0').each((index, element) => {
  
        const headlineFigure = $(element).find('figure > a.sc-1out364-0');
  
        const link = headlineFigure.attr('href');   // Extract the article's link.
        const title = $(headlineFigure).find('img').attr('alt').trim();
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
/*
// Usage for the first set of selectors:
const config1 = {
    articleSelector: 'article.sc-cw4lnv-0',
    anchorSelector: 'figure > a.sc-1out364-0',
    titleSelector: 'img',
    dateSelector: 'time'
};

const articles1 = await extractArticleLinks(htmlContent, config1);

// Usage for the second set of selectors:
const config2 = {
    articleSelector: 'div.listingResult',
    anchorSelector: 'a.article-link',
    titleSelector: 'h3.article-name',
    dateSelector: 'time'
};

export async function extractArticleLinks(htmlContent, config) {
    const $ = cheerio.load(htmlContent);
    const articles = [];

    $(config.articleSelector).each((index, element) => {

        const anchor = $(element).find(config.anchorSelector);
        const link = anchor.attr('href');
        const title = $(anchor).find(config.titleSelector).text().trim();
        const dateElement = $(anchor).find(config.dateSelector);
        const pubDate = dateElement.attr('datetime') || dateElement.text().trim();

        if (title && link) {
            articles.push({ title, link, pubDate });
        }
    });

    return articles;
}
*/
export async function getOpenAIReleaseNotes(htmlContent){
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