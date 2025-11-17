import axios from 'axios';

export interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

export class RobotsParser {
  private rules: RobotsRule[] = [];
  private sitemaps: string[] = [];

  async parse(domain: string): Promise<void> {
    try {
      const robotsUrl = `${domain}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'SiteTracker/1.0 (Website Audit Bot)',
        },
      });

      const lines = response.data.split('\n');
      let currentUserAgent: string | null = null;
      let currentRule: RobotsRule | null = null;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          continue;
        }

        // Parse User-agent
        const userAgentMatch = trimmedLine.match(/^User-agent:\s*(.+)$/i);
        if (userAgentMatch) {
          if (currentRule) {
            this.rules.push(currentRule);
          }
          currentUserAgent = userAgentMatch[1].trim();
          currentRule = {
            userAgent: currentUserAgent,
            disallow: [],
            allow: [],
          };
          continue;
        }

        // Parse Disallow
        const disallowMatch = trimmedLine.match(/^Disallow:\s*(.*)$/i);
        if (disallowMatch && currentRule) {
          const path = disallowMatch[1].trim();
          if (path) {
            currentRule.disallow.push(path);
          }
          continue;
        }

        // Parse Allow
        const allowMatch = trimmedLine.match(/^Allow:\s*(.*)$/i);
        if (allowMatch && currentRule) {
          const path = allowMatch[1].trim();
          if (path) {
            currentRule.allow.push(path);
          }
          continue;
        }

        // Parse Sitemap
        const sitemapMatch = trimmedLine.match(/^Sitemap:\s*(.+)$/i);
        if (sitemapMatch) {
          this.sitemaps.push(sitemapMatch[1].trim());
          continue;
        }
      }

      // Add the last rule
      if (currentRule) {
        this.rules.push(currentRule);
      }
    } catch (error) {
      console.error('Failed to fetch robots.txt:', error);
      // If robots.txt doesn't exist, allow all
      this.rules = [];
    }
  }

  isAllowed(url: string, userAgent: string = 'SiteTracker'): boolean {
    if (this.rules.length === 0) {
      return true; // No robots.txt or empty rules - allow all
    }

    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    // Find applicable rules (specific user agent and wildcard)
    const applicableRules = this.rules.filter(
      rule => rule.userAgent === '*' || rule.userAgent.toLowerCase().includes(userAgent.toLowerCase())
    );

    if (applicableRules.length === 0) {
      return true; // No applicable rules - allow
    }

    // Check rules in order
    for (const rule of applicableRules) {
      // Check Allow rules first (they take precedence)
      for (const allowPath of rule.allow) {
        if (this.pathMatches(path, allowPath)) {
          return true;
        }
      }

      // Check Disallow rules
      for (const disallowPath of rule.disallow) {
        if (this.pathMatches(path, disallowPath)) {
          return false;
        }
      }
    }

    return true; // Default allow if no rules matched
  }

  private pathMatches(path: string, pattern: string): boolean {
    // Convert robots.txt pattern to regex
    // * matches 0 or more characters
    // $ matches end of URL

    if (pattern === '') {
      return false; // Empty pattern means "allow all" in Disallow, shouldn't match
    }

    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // * becomes .*

    if (pattern.endsWith('$')) {
      regexPattern = regexPattern.slice(0, -2) + '$'; // Exact end match
    } else {
      // Pattern should match the beginning
      regexPattern = '^' + regexPattern;
    }

    const regex = new RegExp(regexPattern);
    return regex.test(path);
  }

  getSitemaps(): string[] {
    return this.sitemaps;
  }

  getRules(): RobotsRule[] {
    return this.rules;
  }
}
