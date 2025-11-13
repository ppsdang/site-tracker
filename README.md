# Site Tracker

A comprehensive website audit and health checker similar to Ahrefs. Analyze websites for SEO, performance, accessibility, security, and best practices. Compare audits over time and benchmark against similar websites.

## Features

- **Comprehensive Website Audits**: Analyze websites across 5 key areas
  - SEO (Search Engine Optimization)
  - Performance (Load times, page size, Core Web Vitals)
  - Accessibility (WCAG compliance, screen reader support)
  - Security (HTTPS, security headers, vulnerabilities)
  - Best Practices (HTML standards, deprecated APIs)

- **Health Score**: Overall website health score (0-100) based on weighted metrics

- **Issue Detection**: Identify critical, high, medium, and low severity issues with actionable recommendations

- **Historical Comparison**: Compare current audit with previous audits to track improvements

- **Trend Analysis**: View audit trends over time with visual charts

- **Benchmarking**: Compare your website against similar audited websites

- **RESTful API**: Full-featured REST API for integration with other tools

- **Web Dashboard**: Beautiful, responsive web interface for viewing audit results

## Technology Stack

- **Backend**: Node.js + TypeScript + Express.js
- **Database**: SQLite (with better-sqlite3)
- **Web Crawler**: Axios + Cheerio
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript

## Installation

### Prerequisites

- Node.js 18+ and npm
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/site-tracker.git
   cd site-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file as needed:
   ```
   PORT=3000
   NODE_ENV=development
   DATABASE_PATH=./data/site-tracker.db
   MAX_CRAWL_DEPTH=3
   MAX_PAGES_PER_SITE=50
   TIMEOUT_MS=30000
   USER_AGENT=SiteTracker/1.0 (Website Audit Bot)
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Web Dashboard: http://localhost:3000
   - API: http://localhost:3000/api

## Usage

### Web Dashboard

1. Open http://localhost:3000 in your browser
2. Enter a website URL (e.g., https://example.com)
3. Click "Run Audit"
4. Wait for the analysis to complete (typically 10-30 seconds)
5. View detailed results including:
   - Overall health score
   - Individual metric scores
   - Detected issues with recommendations
   - Comparison with previous audits (if available)

### API Usage

#### Create a New Audit

```bash
curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "websiteId": 1,
    "url": "https://example.com",
    "healthScore": 85,
    "auditDate": "2025-11-13T10:00:00.000Z",
    "status": "completed",
    "metrics": {
      "seo": { "score": 90, ... },
      "performance": { "score": 80, ... },
      "accessibility": { "score": 85, ... },
      "security": { "score": 95, ... },
      "bestPractices": { "score": 75, ... }
    },
    "issues": [...]
  }
}
```

#### Get Audit by ID

```bash
curl http://localhost:3000/api/audits/1
```

#### Get Comparison with Previous Audit

```bash
curl http://localhost:3000/api/audits/1/comparison
```

#### Get All Websites

```bash
curl http://localhost:3000/api/websites
```

#### Get Audits for a Website

```bash
curl http://localhost:3000/api/websites/1/audits?limit=10
```

#### Get Audit Trend

```bash
curl http://localhost:3000/api/websites/1/trend?limit=10
```

## API Reference

### Endpoints

#### Audits

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audits` | Create a new website audit |
| GET | `/api/audits/:id` | Get audit by ID |
| GET | `/api/audits/:id/comparison` | Compare with previous audit |
| GET | `/api/audits/:id/compare-similar` | Compare with similar websites |

#### Websites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/websites` | Get all websites |
| GET | `/api/websites/by-url?url={url}` | Get website by URL |
| GET | `/api/websites/:id/audits` | Get audits for a website |
| GET | `/api/websites/:id/latest-audit` | Get latest audit |
| GET | `/api/websites/:id/trend` | Get audit trend over time |

#### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

## Scoring System

### Overall Health Score

The overall health score (0-100) is calculated as a weighted average:

- **SEO**: 25%
- **Performance**: 25%
- **Accessibility**: 20%
- **Security**: 20%
- **Best Practices**: 10%

### Individual Metric Scores

Each metric starts at 100 points and deductions are made based on issues found:

#### SEO (25%)
- Missing title tag: -15
- Missing meta description: -10
- No H1 heading: -10
- Multiple H1 headings: -5
- Poor image alt tag coverage: -10
- Few internal links: -5
- Missing canonical tag: -5
- No structured data: -5

#### Performance (25%)
- Load time > 5s: -30
- Load time 3-5s: -20
- Load time 2-3s: -10
- Page size > 5MB: -20
- Page size 3-5MB: -10
- Too many scripts (>20): -10
- Too many stylesheets (>10): -5
- Render-blocking scripts: -10

#### Accessibility (20%)
- Missing alt tags: -20
- No HTML lang attribute: -15
- Form inputs without labels: -15
- Buttons without labels: -10
- No skip navigation links: -5
- No ARIA landmarks: -10

#### Security (20%)
- Not using HTTPS: -40
- Mixed content: -20
- Missing HSTS header: -10
- Missing CSP header: -10
- Missing X-Frame-Options: -5
- Missing X-Content-Type-Options: -5
- Vulnerable libraries: -10

#### Best Practices (10%)
- Missing DOCTYPE: -10
- Missing charset: -10
- Missing viewport: -15
- Deprecated HTML elements: -15
- Console statements: -5
- Missing favicon: -5

## Issue Severity Levels

- **Critical**: Must be fixed immediately (security vulnerabilities, broken functionality)
- **High**: Should be fixed soon (major SEO issues, accessibility barriers)
- **Medium**: Should be addressed (optimization opportunities)
- **Low**: Nice to have (minor improvements)

## Project Structure

```
site-tracker/
├── src/
│   ├── analyzer/              # Analysis modules
│   │   ├── seo-analyzer.ts
│   │   ├── performance-analyzer.ts
│   │   ├── accessibility-analyzer.ts
│   │   ├── security-analyzer.ts
│   │   └── best-practices-analyzer.ts
│   ├── crawler/               # Web crawler
│   │   └── crawler.ts
│   ├── database/              # Database layer
│   │   ├── db.ts
│   │   └── schema.sql
│   ├── routes/                # API routes
│   │   ├── audit-routes.ts
│   │   └── website-routes.ts
│   ├── services/              # Business logic
│   │   ├── audit-service.ts
│   │   └── comparison-service.ts
│   ├── types/                 # TypeScript types
│   │   └── index.ts
│   └── server.ts              # Main server file
├── public/                    # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                      # Database files (created at runtime)
├── dist/                      # Compiled JavaScript (created by build)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Build

```bash
npm run build
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

## Roadmap

- [ ] Advanced performance metrics with Lighthouse integration
- [ ] Mobile vs Desktop comparison
- [ ] Multi-page crawling and site-wide analysis
- [ ] Custom rules and scoring weights
- [ ] PDF report generation
- [ ] Email notifications for scheduled audits
- [ ] Webhooks for audit completion
- [ ] Integration with Google Search Console
- [ ] Competitor analysis
- [ ] SEO keyword tracking

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Acknowledgments

- Inspired by Ahrefs, Lighthouse, and other SEO tools
- Built with modern web technologies
- Open source and free to use

---

**Happy auditing!** 🚀
