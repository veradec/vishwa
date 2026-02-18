const https = require('https');

/**
 * Web search using Brave Search API (if key set) or DuckDuckGo Instant Answer API.
 * Set BRAVE_SEARCH_API_KEY in .env for full web results.
 * @param {string} query - Search query
 * @param {number} count - Number of results (default 5)
 * @returns {Promise<string>} Formatted results
 */
async function webSearch(query, count = 5) {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
        return braveSearch(query, count, braveKey);
    }
    return duckduckgoSearch(query);
}

/**
 * Brave Search API - returns real web results.
 */
function braveSearch(query, count, apiKey) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const options = {
            hostname: 'api.search.brave.com',
            path: `/res/v1/web/search?q=${encodedQuery}&count=${Math.min(count, 10)}`,
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const results = (json.web && json.web.results) || [];
                    if (results.length === 0) return resolve(`No results found for "${query}".`);

                    const formatted = results.slice(0, count).map((r, i) =>
                        `${i + 1}. *${r.title}*\n   ${r.url}\n   ${r.description || ''}`
                    ).join('\n\n');
                    resolve(`Web results for "${query}":\n\n${formatted}`);
                } catch (e) {
                    reject('Failed to parse Brave Search response: ' + e.message);
                }
            });
        }).on('error', e => reject('Brave Search request failed: ' + e.message));
    });
}

/**
 * DuckDuckGo Instant Answer API - free, no key, but limited to instant answers.
 */
function duckduckgoSearch(query) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const options = {
            hostname: 'api.duckduckgo.com',
            path: `/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const parts = [];

                    if (json.AbstractText) {
                        parts.push(`*${json.Heading}*\n${json.AbstractText}\nSource: ${json.AbstractURL}`);
                    }

                    const topics = (json.RelatedTopics || [])
                        .filter(t => t.Text && t.FirstURL)
                        .slice(0, 4);

                    topics.forEach(t => {
                        parts.push(`• ${t.Text}\n  ${t.FirstURL}`);
                    });

                    if (parts.length === 0) {
                        return resolve(`No instant answer found for "${query}". Try setting BRAVE_SEARCH_API_KEY in .env for full web search.`);
                    }

                    resolve(`Search results for "${query}":\n\n${parts.join('\n\n')}`);
                } catch (e) {
                    reject('Failed to parse DuckDuckGo response: ' + e.message);
                }
            });
        }).on('error', e => reject('DuckDuckGo request failed: ' + e.message));
    });
}

module.exports = { webSearch };
