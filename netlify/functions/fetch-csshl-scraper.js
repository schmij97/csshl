// netlify/functions/fetch-csshl-scraper.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get API key from environment variable
    const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
    
    if (!SCRAPER_API_KEY) {
      throw new Error('SCRAPER_API_KEY not configured. Add it to Netlify environment variables.');
    }

    const targetUrl = 'https://u17prep.csshl.hockeytech.com/stats/schedule/all-teams/191/all-months?league=5';
    
    // ScraperAPI endpoint - it renders JavaScript for you!
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true`;
    
    console.log('Fetching via ScraperAPI...');
    
    const response = await fetch(scraperUrl, {
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`ScraperAPI error: ${response.status}`);
    }

    const html = await response.text();
    console.log('HTML received, length:', html.length);

    // Parse the HTML (now it has the rendered content!)
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    const games = [];
    
    // Find the table and extract game data
    $('table tr').each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 7) {
        const date = $(cols[0]).text().trim();
        const status = $(cols[1]).text().trim();
        
        // Skip headers
        if (date.toLowerCase().includes('date')) return;
        
        const visitor = $(cols[2]).find('a').text().trim() || $(cols[2]).text().trim();
        const vScore = $(cols[3]).text().trim();
        const home = $(cols[5]).find('a').text().trim() || $(cols[5]).text().trim();
        const hScore = $(cols[6]).text().trim();
        const venue = cols.length > 7 ? $(cols[7]).text().trim() : '';

        if (status.toLowerCase().includes('final') && visitor && home) {
          games.push({
            date,
            status,
            visitor,
            vScore,
            home,
            hScore,
            venue
          });
        }
      }
    });

    if (games.length === 0) {
      throw new Error('No games found. The page structure may have changed.');
    }

    console.log(`Found ${games.length} games`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ games, count: games.length })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        tip: 'Make sure SCRAPER_API_KEY is set in Netlify environment variables'
      })
    };
  }
};