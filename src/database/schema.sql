-- Websites table
CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_audited_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites(domain);
CREATE INDEX IF NOT EXISTS idx_websites_url ON websites(url);

-- Audits table
CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    health_score REAL NOT NULL,
    audit_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('completed', 'in_progress', 'failed', 'cancelled')),

    -- SEO Metrics
    seo_score REAL,
    title_tag INTEGER,
    meta_description INTEGER,
    h1_count INTEGER,
    h2_count INTEGER,
    h3_count INTEGER,
    images_with_alt INTEGER,
    total_images INTEGER,
    internal_links INTEGER,
    external_links INTEGER,
    broken_links INTEGER,
    canonical_tag INTEGER,
    robots_txt INTEGER,
    sitemap INTEGER,
    structured_data INTEGER,

    -- Performance Metrics
    performance_score REAL,
    load_time REAL,
    page_size INTEGER,
    request_count INTEGER,
    ttfb REAL,
    fcp REAL,
    lcp REAL,
    cls REAL,
    tbt REAL,

    -- Accessibility Metrics
    accessibility_score REAL,
    missing_alt_tags INTEGER,
    color_contrast INTEGER,
    aria_labels INTEGER,
    form_labels INTEGER,
    button_labels INTEGER,
    html_lang INTEGER,
    skip_links INTEGER,

    -- Security Metrics
    security_score REAL,
    https INTEGER,
    mixed_content INTEGER,
    hsts INTEGER,
    csp INTEGER,
    x_frame_options INTEGER,
    x_content_type INTEGER,
    referrer_policy INTEGER,

    -- Best Practices Metrics
    best_practices_score REAL,
    doctype INTEGER,
    charset INTEGER,
    viewport INTEGER,
    console_errors INTEGER,
    deprecated_apis INTEGER,

    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audits_website_id ON audits(website_id);
CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(audit_date);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);

-- Issues table
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    element TEXT,
    recommendation TEXT NOT NULL,

    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issues_audit_id ON issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);

-- Pages table (for multi-page audits)
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    title TEXT,
    meta_description TEXT,
    word_count INTEGER,
    crawled_at TEXT NOT NULL,
    canonical_url TEXT,
    content_hash TEXT,
    noindex INTEGER DEFAULT 0,
    nofollow INTEGER DEFAULT 0,
    in_sitemap INTEGER DEFAULT 0,
    incoming_links_count INTEGER DEFAULT 0,
    outgoing_links_count INTEGER DEFAULT 0,
    load_time REAL,
    page_size INTEGER,

    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_audit_id ON pages(audit_id);
CREATE INDEX IF NOT EXISTS idx_pages_content_hash ON pages(content_hash);
CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);

-- Links table (for tracking internal link relationships)
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    from_url TEXT NOT NULL,
    to_url TEXT NOT NULL,
    anchor_text TEXT,

    FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_links_audit_id ON links(audit_id);
CREATE INDEX IF NOT EXISTS idx_links_from_url ON links(from_url);
CREATE INDEX IF NOT EXISTS idx_links_to_url ON links(to_url);
