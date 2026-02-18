const https = require('https');

/**
 * Fetches papers from the ArXiv API.
 * @param {string} query - Search query string
 * @param {number} count - Number of results (default 5)
 * @returns {Promise<string>} Formatted string of results
 */
function fetchArxiv(query, count = 5) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${count}&sortBy=submittedDate&sortOrder=descending`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const results = parseArxivXML(data);
                    if (results.length === 0) {
                        resolve(`No papers found for "${query}".`);
                        return;
                    }
                    const formatted = results.map(p => {
                        const summary = p.summary.length > 300
                            ? p.summary.slice(0, 297) + '...'
                            : p.summary;
                        return `### [${p.published}] ${p.title}\n- **Authors**: ${p.authors}\n- **Link**: ${p.link}\n- **Summary**: ${summary}`;
                    }).join('\n\n');
                    resolve(`ArXiv results for "${query}":\n\n${formatted}`);
                } catch (e) {
                    reject('Failed to parse ArXiv response: ' + e.message);
                }
            });
        }).on('error', (e) => {
            reject('ArXiv request failed: ' + e.message);
        });
    });
}

/**
 * Parses ArXiv Atom XML into an array of paper objects.
 */
function parseArxivXML(xml) {
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];

        const title = extractTag(entry, 'title').replace(/\s+/g, ' ').trim();
        const published = extractTag(entry, 'published').split('T')[0];
        const link = (entry.match(/<id>(.*?)<\/id>/) || [])[1] || '';

        const authorMatches = [...entry.matchAll(/<name>(.*?)<\/name>/g)];
        const authors = authorMatches.map(m => m[1]).slice(0, 3).join(', ');
        const moreAuthors = authorMatches.length > 3 ? ` +${authorMatches.length - 3} more` : '';

        const summary = extractTag(entry, 'summary').replace(/\s+/g, ' ').trim();

        entries.push({ title, published, link, authors: authors + moreAuthors, summary });
    }

    return entries;
}

function extractTag(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : '';
}

module.exports = { fetchArxiv };
