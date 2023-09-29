// index.mjs
import express from 'express';
import Parser from 'rss-parser';
import cheerio from 'cheerio';
import { getOpenAIResponse } from './utils/openaiHandler.js';

const app = express();
const port = 3000;

const parser = new Parser();

app.get('/rss', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL is required as a query parameter.');
  }
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const text = await response.text();
    const feed = await parser.parseString(text);
    let html = '<h1>' + feed.title + '</h1>';
    html += '<ul>';
    for (const item of feed.items) {
      html += '<li><a href="' + item.link + '">' + item.title + '</a><br>';
      const pageResponse = await fetch(item.link);
      const pageText = await pageResponse.text();
      const $ = cheerio.load(pageText);

        html += $('article').text();
         html += '</li>';
    }
    html += '</ul>';
    res.send(html);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
