#!/usr/bin/env node

/**
 * Script to create 50 random website monitors
 * Usage: node create_200_monitors.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// List of popular websites for monitoring
const websites = [
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
    'linkedin.com', 'wikipedia.org', 'reddit.com', 'amazon.com', 'ebay.com',
    'netflix.com', 'spotify.com', 'github.com', 'stackoverflow.com', 'medium.com',
    'discord.com', 'telegram.org', 'whatsapp.com', 'zoom.us', 'microsoft.com',
    'apple.com', 'adobe.com', 'dropbox.com', 'slack.com', 'trello.com',
    'notion.so', 'figma.com', 'canva.com', 'unsplash.com', 'pexels.com',
    'cloudflare.com', 'digitalocean.com', 'heroku.com', 'vercel.com', 'netlify.com',
    'aws.amazon.com', 'azure.microsoft.com', 'cloud.google.com', 'firebase.google.com',
    'mongodb.com', 'postgresql.org', 'mysql.com', 'redis.io', 'elastic.co',
    'docker.com', 'kubernetes.io', 'jenkins.io', 'gitlab.com', 'bitbucket.org',
    'npmjs.com', 'pypi.org', 'packagist.org', 'rubygems.org', 'nuget.org',
    'unity.com', 'unrealengine.com', 'blender.org', 'gimp.org', 'inkscape.org',
    'wordpress.com', 'drupal.org', 'joomla.org', 'shopify.com', 'woocommerce.com',
    'stripe.com', 'paypal.com', 'square.com', 'twilio.com', 'sendgrid.com',
    'mailchimp.com', 'hubspot.com', 'salesforce.com', 'zendesk.com', 'intercom.com',
    'atlassian.com', 'asana.com', 'monday.com', 'clickup.com', 'airtable.com',
    'typeform.com', 'surveymonkey.com', 'calendly.com', 'docusign.com', 'adobe.io',
    'twitch.tv', 'vimeo.com', 'dailymotion.com', 'soundcloud.com', 'bandcamp.com',
    'pinterest.com', 'tumblr.com', 'flickr.com', 'deviantart.com', 'behance.net',
    'dribbble.com', 'awwwards.com', 'codepen.io', 'jsfiddle.net', 'replit.com',
    'glitch.com', 'codesandbox.io', 'stackblitz.com', 'observablehq.com', 'kaggle.com',
    'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'codecademy.com',
    'freecodecamp.org', 'w3schools.com', 'mdn.mozilla.org', 'css-tricks.com', 'smashingmagazine.com',
    'aliexpress.com', 'wish.com', 'etsy.com', 'shopee.com', 'lazada.com',
    'booking.com', 'airbnb.com', 'expedia.com', 'tripadvisor.com', 'hotels.com',
    'uber.com', 'lyft.com', 'doordash.com', 'grubhub.com', 'postmates.com',
    'weather.com', 'accuweather.com', 'bbc.com', 'cnn.com', 'reuters.com',
    'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'forbes.com', 'bloomberg.com',
    'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', 'engadget.com',
    'cnet.com', 'pcmag.com', 'tomshardware.com', 'anandtech.com', 'gsmarena.com',
    'imdb.com', 'rottentomatoes.com', 'metacritic.com', 'goodreads.com', 'audible.com',
    'steam.com', 'epicgames.com', 'origin.com', 'ubisoft.com', 'ea.com',
    'nintendo.com', 'playstation.com', 'xbox.com', 'twitch.tv', 'mixer.com',
    'coinbase.com', 'binance.com', 'kraken.com', 'blockchain.info', 'coinmarketcap.com',
    'indeed.com', 'glassdoor.com', 'monster.com', 'careerbuilder.com', 'ziprecruiter.com',
    'craigslist.org', 'olx.com', 'gumtree.com', 'leboncoin.fr', 'mercadolibre.com',
    'quora.com', 'stackexchange.com', 'yahoo.com', 'bing.com', 'duckduckgo.com',
    'startpage.com', 'searx.org', 'yandex.com', 'baidu.com', 'naver.com',
    'line.me', 'wechat.com', 'viber.com', 'skype.com', 'signal.org',
    'protonmail.com', 'tutanota.com', 'gmail.com', 'outlook.com', 'yahoo.mail.com',
    'icloud.com', 'onedrive.com', 'googledrive.com', 'box.com', 'mega.nz',
    'wetransfer.com', 'filemail.com', 'sendspace.com', 'mediafire.com', 'rapidshare.com',
    'torproject.org', 'nordvpn.com', 'expressvpn.com', 'surfshark.com', 'cyberghost.com',
    'malwarebytes.com', 'kaspersky.com', 'norton.com', 'mcafee.com', 'bitdefender.com',
    'avast.com', 'avg.com', 'eset.com', 'f-secure.com', 'trendmicro.com'
];

// Generate random monitors
function generateMonitors() {
    const dbPath = path.join(__dirname, 'data/v1/kuma.db');
    const tempSqlFile = path.join(__dirname, 'temp_bulk_monitors.sql');
    
    let sql = '';
    
    for (let i = 0; i < 50; i++) {
        const website = websites[Math.floor(Math.random() * websites.length)];
        const protocol = Math.random() > 0.3 ? 'https' : 'http'; // 70% HTTPS, 30% HTTP
        const url = `${protocol}://${website}`;
        const name = `Monitor ${i + 1} - ${website}`;
        const port = protocol === 'https' ? 443 : 80;
        
        sql += `
INSERT INTO monitor (
    name, active, user_id, interval, url, type, weight,
    hostname, port, created_date, maxretries, timeout, method,
    accepted_statuscodes_json
) VALUES (
    '${name.replace(/'/g, "''")}',
    1,
    1,
    60,
    '${url}',
    'http',
    2000,
    '${website}',
    ${port},
    datetime('now'),
    0,
    48,
    'GET',
    '["200-299"]'
);
`;
    }
    
    // Add query to show results
    sql += `
SELECT 'Successfully created 50 monitors!' as result;
SELECT COUNT(*) as total_monitors FROM monitor;
SELECT 'Last 5 created monitors:' as info;
SELECT id, name, url, interval FROM monitor 
WHERE created_date >= datetime('now', '-1 minute')
ORDER BY id DESC 
LIMIT 5;
`;

    try {
        console.log('🚀 Creating 50 random website monitors...');
        
        // Write SQL to temp file
        fs.writeFileSync(tempSqlFile, sql);
        
        // Execute SQL using sqlite3 CLI
        const result = execSync(`sqlite3 "${dbPath}" < "${tempSqlFile}"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        console.log('✅ Successfully created 50 monitors!');
        console.log('📊 Monitor details:');
        console.log('   - Interval: 60 seconds each');
        console.log('   - Types: HTTP/HTTPS websites');
        console.log('   - Timeout: 48 seconds');
        console.log('   - Status codes: 200-299');
        console.log('   - All monitors are active');
        
        // Show sample of created monitors
        const sampleResult = execSync(`sqlite3 "${dbPath}" "SELECT name, url FROM monitor WHERE created_date >= datetime('now', '-1 minute') ORDER BY id DESC LIMIT 10;"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        console.log('\n📝 Sample of created monitors:');
        console.log(sampleResult);
        
        // Clean up temp file
        fs.unlinkSync(tempSqlFile);
        
    } catch (error) {
        console.error('❌ Error creating monitors:', error.message);
        
        // Clean up temp file on error
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
        
        process.exit(1);
    }
}

// Main execution
console.log('🎯 Bulk Monitor Creator');
console.log('Creating 50 random website monitors with 60-second intervals...\n');

generateMonitors();
