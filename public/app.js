const API_BASE_URL = window.location.origin + '/api';

let currentFilter = 'all';
let currentAudit = null;
let selectedWebsite = null;
let allPages = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadWebsites();
    setupEventListeners();
});

function setupEventListeners() {
    // Add website button
    document.getElementById('addWebsiteBtn').addEventListener('click', () => {
        document.getElementById('addWebsiteForm').style.display = 'block';
        document.getElementById('addWebsiteBtn').style.display = 'none';
    });

    document.getElementById('cancelAddBtn').addEventListener('click', () => {
        document.getElementById('addWebsiteForm').style.display = 'none';
        document.getElementById('addWebsiteBtn').style.display = 'block';
        document.getElementById('newWebsiteForm').reset();
    });

    // New website form
    document.getElementById('newWebsiteForm').addEventListener('submit', handleAddWebsite);

    // Run new audit button
    document.getElementById('runNewAuditBtn')?.addEventListener('click', handleRunNewAudit);

    // Issue filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.severity;
            if (currentAudit) {
                displayIssues(currentAudit.issues);
            }
        });
    });

    // View all pages button
    document.getElementById('viewAllPagesBtn')?.addEventListener('click', showAllPagesModal);

    // Close modal
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);

    // Page search
    document.getElementById('pageSearchInput')?.addEventListener('input', filterPages);
    document.getElementById('pageFilterSelect')?.addEventListener('change', filterPages);
}

async function loadWebsites() {
    try {
        const response = await fetch(`${API_BASE_URL}/websites`);
        const result = await response.json();

        if (result.success) {
            displayWebsites(result.data);
        }
    } catch (error) {
        console.error('Error loading websites:', error);
    }
}

function displayWebsites(websites) {
    const container = document.getElementById('websitesList');

    if (websites.length === 0) {
        container.innerHTML = '<p class="empty-state">No websites added yet. Click "Add New Website" to get started.</p>';
        return;
    }

    container.innerHTML = websites.map(website => `
        <div class="website-card" onclick="selectWebsite(${website.id}, '${escapeHtml(website.url)}')">
            <div class="website-card-url">${escapeHtml(website.url)}</div>
            <div class="website-card-meta">
                ${website.last_audited_at ? `Last audit: ${formatDate(website.last_audited_at)}` : 'Not audited yet'}
            </div>
        </div>
    `).join('');
}

async function selectWebsite(websiteId, url) {
    selectedWebsite = { id: websiteId, url };

    // Hide add form, show details
    document.getElementById('addWebsiteForm').style.display = 'none';
    document.getElementById('addWebsiteBtn').style.display = 'block';
    document.getElementById('websiteDetails').style.display = 'block';
    document.getElementById('selectedWebsiteUrl').textContent = url;

    // Load audit history
    await loadAuditHistory(websiteId);
}

async function loadAuditHistory(websiteId) {
    try {
        const response = await fetch(`${API_BASE_URL}/websites/${websiteId}/audits?limit=20`);
        const result = await response.json();

        if (result.success) {
            const audits = result.data;
            document.getElementById('totalAudits').textContent = audits.length;

            if (audits.length > 0) {
                document.getElementById('lastAuditDate').textContent = formatDate(audits[0].audit_date);
                displayAuditHistory(audits);
            } else {
                document.getElementById('lastAuditDate').textContent = 'Never';
                document.getElementById('auditHistoryList').innerHTML = '<p class="empty-state">No audits yet. Click "Run New Audit" to start.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading audit history:', error);
    }
}

function displayAuditHistory(audits) {
    const container = document.getElementById('auditHistoryList');

    container.innerHTML = audits.map(audit => `
        <div class="audit-history-item" onclick="loadAuditDetails(${audit.id})">
            <div class="audit-history-date">${formatDate(audit.audit_date)}</div>
            <div class="audit-history-score">
                <span class="score-badge score-${getScoreClass(audit.health_score)}">${audit.health_score}</span>
            </div>
            <div class="audit-history-status">
                <span class="status-badge status-${audit.status}">${audit.status}</span>
            </div>
        </div>
    `).join('');
}

async function handleAddWebsite(e) {
    e.preventDefault();

    const url = document.getElementById('newWebsiteUrl').value;
    const progressSection = document.getElementById('auditProgress');
    const addForm = document.getElementById('addWebsiteForm');

    // Show progress
    addForm.style.display = 'none';
    progressSection.style.display = 'block';
    updateProgress('Initializing full site crawl...', 0);

    try {
        // Start the audit
        const audit = await startAudit(url);

        // Audit completed
        document.getElementById('newWebsiteForm').reset();
        progressSection.style.display = 'none';

        // Reload websites and select the new one
        await loadWebsites();

        // Show results
        currentAudit = audit;
        displayAuditResults(audit);

        // Load pages
        await loadAuditPages(audit.id);
    } catch (error) {
        alert('Error: ' + error.message);
        progressSection.style.display = 'none';
        addForm.style.display = 'block';
    }
}

async function handleRunNewAudit() {
    if (!selectedWebsite) return;

    const progressSection = document.getElementById('auditProgress');
    const resultsSection = document.getElementById('resultsSection');

    // Hide results, show progress
    resultsSection.style.display = 'none';
    progressSection.style.display = 'block';
    updateProgress('Initializing full site crawl...', 0);

    try {
        // Start the audit
        const audit = await startAudit(selectedWebsite.url);

        // Audit completed
        progressSection.style.display = 'none';

        // Reload audit history
        await loadAuditHistory(selectedWebsite.id);

        // Show results
        currentAudit = audit;
        displayAuditResults(audit);

        // Load pages
        await loadAuditPages(audit.id);
    } catch (error) {
        alert('Error: ' + error.message);
        progressSection.style.display = 'none';
    }
}

async function startAudit(url) {
    // Simulate progress updates (since backend doesn't stream progress)
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + 5, 90);
        updateProgress(`Crawling pages... (This may take a few minutes)`, progress);
    }, 1000);

    try {
        const response = await fetch(`${API_BASE_URL}/audits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        clearInterval(progressInterval);

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        updateProgress('Audit completed!', 100);
        setTimeout(() => {}, 500);

        return result.data;
    } catch (error) {
        clearInterval(progressInterval);
        throw error;
    }
}

function updateProgress(text, percentage) {
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressBarFill').style.width = `${percentage}%`;

    // Update stats if available
    const crawledPages = Math.floor(percentage / 2); // Simulated
    document.getElementById('crawledCount').textContent = crawledPages;
    document.getElementById('queuedCount').textContent = Math.max(0, 50 - crawledPages);
}

async function loadAuditPages(auditId) {
    try {
        const response = await fetch(`${API_BASE_URL}/audits/${auditId}/pages`);
        const result = await response.json();

        if (result.success) {
            allPages = result.data;
        }
    } catch (error) {
        console.error('Error loading pages:', error);
    }
}

async function loadAuditDetails(auditId) {
    try {
        const response = await fetch(`${API_BASE_URL}/audits/${auditId}`);
        const result = await response.json();

        if (result.success) {
            currentAudit = result.data;
            displayAuditResults(result.data);
            await loadAuditPages(auditId);
        }
    } catch (error) {
        console.error('Error loading audit details:', error);
    }
}

function displayAuditResults(audit) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    // Health score
    const healthScoreValue = document.getElementById('healthScoreValue');
    const healthScoreCircle = document.getElementById('healthScoreCircle');
    healthScoreValue.textContent = audit.healthScore;

    // Set color based on score
    healthScoreCircle.classList.remove('excellent', 'good', 'fair', 'poor');
    healthScoreCircle.classList.add(getScoreClass(audit.healthScore));

    // Summary stats
    document.getElementById('totalPagesCrawled').textContent = allPages.length;
    const sitemapPages = allPages.filter(p => p.in_sitemap).length;
    document.getElementById('sitemapPagesCount').textContent = sitemapPages;
    document.getElementById('discoveredPagesCount').textContent = allPages.length - sitemapPages;

    // Individual metrics
    updateMetric('seo', audit.metrics.seo.score);
    updateMetric('performance', audit.metrics.performance.score);
    updateMetric('accessibility', audit.metrics.accessibility.score);
    updateMetric('security', audit.metrics.security.score);
    updateMetric('bestPractices', audit.metrics.bestPractices.score);

    // Issues
    displayIssues(audit.issues);
}

function updateMetric(name, score) {
    const roundedScore = Math.round(score);
    document.getElementById(`${name}Score`).textContent = roundedScore;
    document.getElementById(`${name}Bar`).style.width = `${roundedScore}%`;
}

function displayIssues(issues) {
    const issuesList = document.getElementById('issuesList');
    const issueCount = document.getElementById('issueCount');

    // Filter issues
    const filteredIssues = currentFilter === 'all'
        ? issues
        : issues.filter(issue => issue.severity === currentFilter);

    issueCount.textContent = filteredIssues.length;

    if (filteredIssues.length === 0) {
        issuesList.innerHTML = '<p class="empty-state">No issues found in this category</p>';
        return;
    }

    issuesList.innerHTML = filteredIssues.map(issue => `
        <div class="issue-item ${issue.severity}">
            <div class="issue-header">
                <span class="issue-title">${escapeHtml(issue.title)}</span>
                <span class="issue-severity ${issue.severity}">${issue.severity}</span>
            </div>
            <div class="issue-category">${escapeHtml(issue.category)}</div>
            <div class="issue-description">${escapeHtml(issue.description)}</div>
            ${issue.element ? `<div class="issue-element">Element: ${escapeHtml(issue.element)}</div>` : ''}
            <div class="issue-recommendation">💡 ${escapeHtml(issue.recommendation)}</div>
        </div>
    `).join('');
}

function showAllPagesModal() {
    if (allPages.length === 0) {
        alert('No pages data available. Please wait for the audit to complete.');
        return;
    }

    document.getElementById('pagesModal').style.display = 'flex';
    filterPages();
}

function closeModal() {
    document.getElementById('pagesModal').style.display = 'none';
}

function filterPages() {
    const searchTerm = document.getElementById('pageSearchInput').value.toLowerCase();
    const filterType = document.getElementById('pageFilterSelect').value;

    let filtered = allPages;

    // Apply filter
    if (filterType === 'sitemap') {
        filtered = filtered.filter(p => p.in_sitemap === 1);
    } else if (filterType === 'discovered') {
        filtered = filtered.filter(p => p.in_sitemap === 0);
    } else if (filterType === 'orphan') {
        filtered = filtered.filter(p => p.incoming_links_count === 0);
    } else if (filterType === 'noindex') {
        filtered = filtered.filter(p => p.noindex === 1);
    }

    // Apply search
    if (searchTerm) {
        filtered = filtered.filter(p => p.url.toLowerCase().includes(searchTerm));
    }

    displayFilteredPages(filtered);
}

function displayFilteredPages(pages) {
    const container = document.getElementById('pagesListContainer');

    if (pages.length === 0) {
        container.innerHTML = '<p class="empty-state">No pages match your criteria</p>';
        return;
    }

    container.innerHTML = `
        <div class="pages-table">
            <table>
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Status</th>
                        <th>In Sitemap</th>
                        <th>Incoming Links</th>
                        <th>Outgoing Links</th>
                        <th>Issues</th>
                    </tr>
                </thead>
                <tbody>
                    ${pages.map(page => `
                        <tr>
                            <td class="page-url" title="${escapeHtml(page.url)}">
                                ${truncateUrl(page.url, 50)}
                                ${page.canonical_url && page.canonical_url !== page.url ? '<span class="badge">Non-canonical</span>' : ''}
                                ${page.noindex ? '<span class="badge badge-warning">Noindex</span>' : ''}
                            </td>
                            <td>${page.status_code || 'N/A'}</td>
                            <td>${page.in_sitemap ? '✅' : '❌'}</td>
                            <td>${page.incoming_links_count || 0}</td>
                            <td>${page.outgoing_links_count || 0}</td>
                            <td>
                                ${page.incoming_links_count === 0 ? '<span class="badge badge-danger">Orphan</span>' : ''}
                                ${page.noindex && page.in_sitemap ? '<span class="badge badge-danger">Noindex in sitemap</span>' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return escapeHtml(url);
    return escapeHtml(url.substring(0, maxLength)) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
