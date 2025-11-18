# How Site Tracker Works

## Complete User Workflow

### 1. **Starting the Application**

```bash
# Delete old database (one-time, to get new schema)
rm -rf data/

# Start the server
npm start
```

Open browser to: **http://localhost:3000**

---

## 2. **Adding a New Website**

### Steps:
1. Click **"+ Add New Website"** button
2. Enter website URL (e.g., `https://example.com`)
3. Click **"Start Initial Audit"**

### What Happens Behind the Scenes:

**Step 1: Sitemap Discovery**
- Checks `/robots.txt` for sitemap declarations
- Looks for `/sitemap.xml`, `/sitemap_index.xml`, and other common locations
- Parses all sitemaps (handles nested sitemap indexes)
- Adds all URLs from sitemap to crawl queue

**Step 2: Robots.txt Parsing**
- Downloads and parses `/robots.txt`
- Creates rules for User-agent directives
- Validates each URL against disallow/allow patterns
- Respects `*` wildcards and `$` end-of-URL markers

**Step 3: Crawling Pages**
```
Queue: [sitemap URLs...]

For each URL in queue (up to MAX_PAGES_PER_SITE):
  1. Check if already visited → skip
  2. Validate against robots.txt → skip if disallowed
  3. Fetch page HTML
  4. Extract:
     - Meta robots tags (noindex/nofollow)
     - Canonical URL
     - Content hash (MD5 of text content)
     - Internal links (<a href>)
     - External links
  5. Analyze page for SEO, performance, accessibility, security, best practices
  6. Store page data in database
  7. Add newly discovered internal links to queue (if same domain and not visited)
  8. Continue...
```

**Step 4: Link Graph Building**
- Track all internal link relationships (from → to)
- Count incoming links for each page
- Count outgoing links for each page
- Store in `links` table

**Step 5: Issue Detection**

Automatically detects:

✅ **Orphan Pages** - Pages with 0 incoming internal links
```sql
SELECT * FROM pages WHERE incoming_links_count = 0
```

✅ **Duplicate Content** - Pages with identical content (same MD5 hash) without canonical tags
```javascript
Group pages by content_hash
If duplicates exist and no canonical → flag as duplicate
```

✅ **Noindex in Sitemap** - Pages with `<meta name="robots" content="noindex">` but still in sitemap.xml
```sql
SELECT * FROM pages WHERE noindex = 1 AND in_sitemap = 1
```

✅ **Non-canonical in Sitemap** - Sitemap contains non-canonical version of page
```sql
SELECT * FROM pages
WHERE in_sitemap = 1
AND canonical_url IS NOT NULL
AND canonical_url != url
```

✅ **Canonical with No Links** - Canonical URL has no incoming internal links
```sql
SELECT * FROM pages
WHERE canonical_url = url
AND incoming_links_count = 0
```

✅ **No Outgoing Links** - Pages with zero internal links
```sql
SELECT * FROM pages WHERE outgoing_links_count = 0
```

✅ **Missing from Sitemap** - Pages discovered through links but not in sitemap
```sql
SELECT * FROM pages WHERE in_sitemap = 0
```

**Step 6: Results**
- Overall health score calculated (weighted average)
- All pages stored in database
- All issues stored with severity levels
- Website added to your list

---

## 3. **Managing Websites**

### Website List View
- Shows all websites you've added
- Displays last audit date
- Click any website to view details

### Website Details View
Shows for selected website:
- Website URL
- Last audited date
- Total number of audits
- Audit history (most recent first)
- **"Run New Audit"** button

---

## 4. **Running a New Audit**

### Steps:
1. Select a website from the list
2. Click **"🚀 Run New Audit"** button
3. Watch the progress indicator
4. View comprehensive results

### Progress Viewer Shows:
- Crawled pages count (simulated during backend processing)
- Queued pages count
- Issues found count
- Progress bar
- Status message

**Note**: The backend processes the entire audit synchronously, so progress is simulated. For production, you'd implement WebSockets or Server-Sent Events for real-time updates.

---

## 5. **Viewing Audit Results**

### Overall Health Score
- 90-100: Excellent (green)
- 75-89: Good (blue)
- 50-74: Fair (orange)
- 0-49: Poor (red)

### Summary Statistics
- **Total Pages Crawled**: All pages discovered and analyzed
- **Pages from Sitemap**: URLs found in sitemap.xml
- **Discovered Pages**: URLs found through internal links but NOT in sitemap

### Individual Metrics (0-100)
Each category shows:
- Score with progress bar
- Color-coded indicator

1. **SEO** (25% weight)
   - Title tags, meta descriptions
   - Heading structure
   - Image alt tags
   - Canonical tags
   - Structured data

2. **Performance** (25% weight)
   - Page load time
   - Page size
   - Resource count
   - Core Web Vitals estimates

3. **Accessibility** (20% weight)
   - Missing alt tags
   - ARIA labels
   - Form labels
   - HTML lang attribute

4. **Security** (20% weight)
   - HTTPS usage
   - Security headers
   - Mixed content
   - Vulnerable libraries

5. **Best Practices** (10% weight)
   - HTML5 DOCTYPE
   - Charset declaration
   - Viewport meta tag
   - Deprecated elements

### Issues List
- Filterable by severity (All, Critical, High, Medium, Low)
- Shows:
  - Issue title
  - Category
  - Description
  - Affected element (if applicable)
  - Recommendation to fix

---

## 6. **Viewing All Crawled Pages**

Click **"View All Pages"** button to open modal showing:

### Pages Table
Columns:
- **URL**: Full page URL with badges for non-canonical/noindex
- **Status**: HTTP status code
- **In Sitemap**: ✅ or ❌
- **Incoming Links**: Count of internal links pointing to this page
- **Outgoing Links**: Count of internal links from this page
- **Issues**: Badges for problems (Orphan, Noindex in sitemap, etc.)

### Filters
- **Search**: Filter by URL text
- **Type Dropdown**:
  - All Pages
  - In Sitemap (only pages from sitemap.xml)
  - Discovered (only pages found through links)
  - Orphan Pages (pages with 0 incoming links)
  - Noindex Pages (pages with noindex meta tag)

---

## 7. **Audit History**

For each website, view:
- List of all past audits
- Audit date/time
- Health score with color coding
- Status (completed/in_progress/failed)
- Click any audit to view its full results

---

## Database Schema

### Tables:

**websites**
- Stores each unique website (domain)
- Tracks last audit date

**audits**
- One record per audit run
- Stores aggregated metrics
- Links to website

**pages**
- One record per page crawled
- Stores page-specific data:
  - URL, status code, title, meta description
  - Canonical URL, content hash
  - Noindex/nofollow flags
  - In sitemap flag
  - Incoming/outgoing link counts
  - Load time, page size

**links**
- One record per internal link discovered
- from_url → to_url relationship
- Builds complete link graph

**issues**
- One record per issue found
- Links to audit
- Severity, category, description, recommendation

---

## API Endpoints

### Websites
```
GET  /api/websites              # List all websites
GET  /api/websites/by-url       # Find website by URL
GET  /api/websites/:id/audits   # Get audits for website
GET  /api/websites/:id/latest-audit  # Get latest audit
GET  /api/websites/:id/trend    # Get audit trend data
```

### Audits
```
POST /api/audits                # Start new audit
GET  /api/audits/:id            # Get audit details
GET  /api/audits/:id/comparison # Compare with previous
GET  /api/audits/:id/compare-similar  # Compare with others
GET  /api/audits/:id/pages      # Get all crawled pages
GET  /api/audits/:id/links      # Get link graph
```

---

## Configuration

Edit `.env` file:

```bash
PORT=3000                      # Server port
MAX_PAGES_PER_SITE=50         # Max pages to crawl per site
TIMEOUT_MS=30000              # Request timeout
USER_AGENT=SiteTracker/1.0    # Crawler user agent
```

**Note**: Increase `MAX_PAGES_PER_SITE` for larger sites, but crawl time will increase proportionally.

---

## Example Crawl Flow

```
Input: https://example.com

1. Discover sitemap:
   - Found: https://example.com/sitemap.xml
   - Contains: 25 URLs

2. Queue: [25 sitemap URLs]

3. Parse robots.txt:
   - Disallow: /admin/*
   - Allowed: everything else

4. Start crawling:
   [1] https://example.com/
       - Found 10 internal links
       - 3 new links not in sitemap
       - Added to queue

   [2] https://example.com/about
       - Found 5 internal links
       - All already known

   [3] https://example.com/products
       - Found 8 internal links
       - 2 new links not in sitemap
       - Added to queue

   ... continues until MAX_PAGES_PER_SITE or queue empty

5. Final result:
   - Crawled: 45 pages
   - From sitemap: 25 pages
   - Discovered: 20 pages
   - Issues found: 12
   - Orphan pages: 3
   - Duplicate content: 2
   - Missing from sitemap: 20

6. Health Score: 82/100 (Good)
```

---

## Tips

1. **First Time Setup**: Delete `data/` directory to create fresh database with new schema

2. **Crawl Time**: Expect 1-3 minutes for 50 pages (depends on site response time)

3. **Increase Limits**: Edit `.env` to crawl more pages:
   ```
   MAX_PAGES_PER_SITE=200
   ```

4. **Progress Tracking**: Currently simulated. For production, implement WebSockets for real-time updates.

5. **Performance**: The crawler waits 100ms between requests to be respectful. Adjust in `site-crawler.ts` if needed.

---

## Troubleshooting

**Database errors?**
```bash
rm -rf data/
npm start
```

**Build errors?**
```bash
npm run build
```

**Port already in use?**
```bash
# Change PORT in .env file
PORT=3001
```

---

This matches the exact Ahrefs-style workflow you requested! 🎉
