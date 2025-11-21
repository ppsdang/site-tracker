const API_BASE_URL = window.location.origin + '/api';

let currentFilter = 'all';
let currentAudit = null;
let selectedWebsite = null;
let allPages = [];
let currentAuditId = null;
let currentEventSource = null;

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

    // Cancel audit button
    document.getElementById('cancelAuditBtn')?.addEventListener('click', handleCancelAudit);

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

            // Check if there's an in-progress audit
            const inProgressAudit = audits.find(audit => audit.status === 'in_progress');
            const runAuditBtn = document.getElementById('runNewAuditBtn');

            if (inProgressAudit) {
                // Store audit ID so cancel button can work
                currentAuditId = inProgressAudit.id;

                // Disable button and show message
                runAuditBtn.disabled = true;
                runAuditBtn.classList.add('disabled');
                runAuditBtn.textContent = '⏳ Audit in Progress';

                // Show the in-progress audit details
                document.getElementById('auditProgress').style.display = 'block';
                document.getElementById('progressText').textContent = 'Reconnecting to audit in progress...';

                // Try to connect to SSE stream (in case audit is actually running)
                try {
                    console.log(`[${new Date().toISOString()}] Reconnecting to in-progress audit ${inProgressAudit.id}`);
                    const eventSource = new EventSource(`${API_BASE_URL}/audits/${inProgressAudit.id}/progress`);
                    currentEventSource = eventSource;
                    console.log(`[${new Date().toISOString()}] EventSource created for reconnection, readyState: ${eventSource.readyState}`);

                    eventSource.onopen = (event) => {
                        console.log(`[${new Date().toISOString()}] ✅ SSE Reconnection OPENED for audit ${inProgressAudit.id}`);
                    };

                    eventSource.onmessage = (event) => {
                        const progressData = JSON.parse(event.data);
                        console.log(`[${new Date().toISOString()}] 📨 SSE Reconnection message:`, progressData);

                        switch (progressData.type) {
                            case 'connected':
                                updateProgress('Reconnected to audit stream...', 0);
                                break;
                            case 'crawling':
                                updateProgress(
                                    progressData.message,
                                    progressData.percentage || 0,
                                    progressData.crawledCount || 0,
                                    progressData.queuedCount || 0,
                                    progressData.currentUrl
                                );
                                break;
                            case 'completed':
                                eventSource.close();
                                currentEventSource = null;
                                currentAuditId = null;
                                loadAuditHistory(websiteId);
                                break;
                        }
                    };

                    eventSource.onerror = (error) => {
                        // SSE connection failed - audit probably not actually running
                        console.error(`[${new Date().toISOString()}] ❌ SSE Reconnection ERROR:`, error);
                        console.error(`[${new Date().toISOString()}] EventSource readyState: ${eventSource.readyState}`);
                        eventSource.close();
                        currentEventSource = null;
                        document.getElementById('progressText').textContent =
                            'Audit may have been interrupted. Click "Cancel Audit" to clear this status.';
                    };
                } catch (error) {
                    console.error('Failed to connect to SSE:', error);
                }
            } else {
                // Enable button
                runAuditBtn.disabled = false;
                runAuditBtn.classList.remove('disabled');
                runAuditBtn.textContent = '🚀 Run New Audit';
            }

            if (audits.length > 0) {
                document.getElementById('lastAuditDate').textContent = formatDate(audits[0].auditDate);
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
            <div class="audit-history-date">${formatDate(audit.auditDate)}</div>
            <div class="audit-history-score">
                <span class="score-badge score-${getScoreClass(audit.healthScore)}">${audit.healthScore}</span>
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

    const runAuditBtn = document.getElementById('runNewAuditBtn');

    // Check if button is disabled (audit already in progress)
    if (runAuditBtn.disabled) {
        alert('An audit is already in progress for this website. Please wait for it to complete.');
        return;
    }

    const progressSection = document.getElementById('auditProgress');
    const resultsSection = document.getElementById('resultsSection');

    // Disable button while audit is running
    runAuditBtn.disabled = true;
    runAuditBtn.classList.add('disabled');
    runAuditBtn.textContent = '⏳ Audit in Progress';

    // Hide results, show progress
    resultsSection.style.display = 'none';
    progressSection.style.display = 'block';
    updateProgress('Initializing full site crawl...', 0);

    try {
        // Start the audit
        const audit = await startAudit(selectedWebsite.url);

        // Audit completed
        progressSection.style.display = 'none';

        // Reload audit history (this will re-enable the button)
        await loadAuditHistory(selectedWebsite.id);

        // Show results
        currentAudit = audit;
        displayAuditResults(audit);

        // Load pages
        await loadAuditPages(audit.id);
    } catch (error) {
        alert('Error: ' + error.message);
        progressSection.style.display = 'none';

        // Re-enable button on error
        runAuditBtn.disabled = false;
        runAuditBtn.classList.remove('disabled');
        runAuditBtn.textContent = '🚀 Run New Audit';
    }
}

async function handleCancelAudit() {
    if (!currentAuditId) {
        alert('No audit is currently running');
        return;
    }

    const confirmed = confirm('Are you sure you want to cancel this audit? All progress will be lost.');

    if (!confirmed) {
        return;
    }

    try {
        // Call cancel endpoint
        const response = await fetch(`${API_BASE_URL}/audits/${currentAuditId}/cancel`, {
            method: 'POST',
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to cancel audit');
        }

        // Close SSE connection
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
        }

        // Hide progress section
        document.getElementById('auditProgress').style.display = 'none';

        // Re-enable run audit button
        const runAuditBtn = document.getElementById('runNewAuditBtn');
        runAuditBtn.disabled = false;
        runAuditBtn.classList.remove('disabled');
        runAuditBtn.textContent = '🚀 Run New Audit';

        // Reload audit history to show cancelled status
        if (selectedWebsite) {
            await loadAuditHistory(selectedWebsite.id);
        }

        currentAuditId = null;

        alert('Audit cancelled successfully');
    } catch (error) {
        console.error('Error cancelling audit:', error);
        alert('Error cancelling audit: ' + error.message);
    }
}

async function startAudit(url) {
    let eventSource = null;

    try {
        // Start the audit
        const response = await fetch(`${API_BASE_URL}/audits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        // Get the audit ID to connect to SSE
        const auditId = result.data.id;

        // Store audit ID and event source globally for cancellation
        currentAuditId = auditId;

        // Connect to SSE for real-time progress
        console.log(`[${new Date().toISOString()}] Creating EventSource for audit ${auditId}`);
        eventSource = new EventSource(`${API_BASE_URL}/audits/${auditId}/progress`);
        currentEventSource = eventSource;
        console.log(`[${new Date().toISOString()}] EventSource created, readyState: ${eventSource.readyState}`);

        return new Promise((resolve, reject) => {
            eventSource.onopen = (event) => {
                console.log(`[${new Date().toISOString()}] ✅ SSE Connection OPENED for audit ${auditId}`, event);
                console.log(`[${new Date().toISOString()}] EventSource readyState: ${eventSource.readyState}`);
            };

            eventSource.onmessage = (event) => {
                try {
                    const progressData = JSON.parse(event.data);
                    console.log(`[${new Date().toISOString()}] 📨 SSE Message received:`, progressData);

                    switch (progressData.type) {
                        case 'connected':
                            updateProgress('Connected to audit stream...', 0);
                            break;

                        case 'sitemap':
                            updateProgress(
                                `Discovered ${progressData.totalUrls || 0} URLs from sitemap(s)`,
                                5,
                                0,
                                progressData.totalUrls || 0
                            );
                            break;

                        case 'crawling':
                            updateProgress(
                                progressData.message,
                                progressData.percentage || 0,
                                progressData.crawledCount || 0,
                                progressData.queuedCount || 0,
                                progressData.currentUrl
                            );
                            break;

                        case 'analyzing':
                            updateProgress(
                                'Analyzing crawled pages and detecting issues...',
                                95,
                                progressData.crawledCount || 0,
                                0
                            );
                            break;

                        case 'completed':
                            updateProgress('Audit completed!', 100, progressData.crawledCount || 0, 0);
                            eventSource.close();
                            currentEventSource = null;
                            currentAuditId = null;
                            setTimeout(() => {
                                resolve(result.data);
                            }, 500);
                            break;

                        case 'error':
                            eventSource.close();
                            currentEventSource = null;
                            currentAuditId = null;
                            reject(new Error(progressData.message || 'Audit failed'));
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };

            eventSource.onerror = (error) => {
                console.error(`[${new Date().toISOString()}] ❌ SSE ERROR:`, error);
                console.error(`[${new Date().toISOString()}] EventSource readyState: ${eventSource.readyState}`);
                console.error(`[${new Date().toISOString()}] EventSource url: ${eventSource.url}`);
                eventSource.close();
                // Don't reject on error - the audit might still complete
                // We'll fall back to checking the result
                setTimeout(() => {
                    resolve(result.data);
                }, 1000);
            };
        });
    } catch (error) {
        if (eventSource) {
            eventSource.close();
        }
        throw error;
    }
}

function updateProgress(text, percentage, crawledCount, queuedCount, currentUrl) {
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressBarFill').style.width = `${percentage}%`;

    // Update stats with real data
    if (crawledCount !== undefined) {
        document.getElementById('crawledCount').textContent = crawledCount;
    }

    if (queuedCount !== undefined) {
        document.getElementById('queuedCount').textContent = queuedCount;
    }

    // Update current URL if provided
    const currentUrlElement = document.getElementById('currentUrl');
    if (currentUrlElement && currentUrl) {
        currentUrlElement.textContent = currentUrl;
        currentUrlElement.title = currentUrl; // Show full URL on hover
    }
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

    // Load comparison with previous audit
    loadComparison(audit.id);
}

async function loadComparison(auditId) {
    try {
        const response = await fetch(`${API_BASE_URL}/audits/${auditId}/comparison`);
        const result = await response.json();

        if (result.success && result.data.previous) {
            displayComparison(result.data);
            // Update issues display with comparison data
            displayIssuesGrouped(result.data.current.issues, result.data.previous.issues);
        } else {
            // Hide comparison section if no previous audit
            document.getElementById('comparisonSection').style.display = 'none';
            // Display issues without comparison
            displayIssuesGrouped(currentAudit.issues, null);
        }
    } catch (error) {
        console.error('Error loading comparison:', error);
        document.getElementById('comparisonSection').style.display = 'none';
        displayIssuesGrouped(currentAudit ? currentAudit.issues : [], null);
    }
}

function displayComparison(comparison) {
    const comparisonSection = document.getElementById('comparisonSection');
    comparisonSection.style.display = 'block';

    const changes = comparison.changes;

    // Health score change
    const healthScoreChange = document.getElementById('healthScoreChange');
    const healthScoreDiff = document.getElementById('healthScoreDiff');
    updateChangeIndicator(healthScoreChange, changes.healthScoreDiff);
    healthScoreDiff.textContent = formatChange(changes.healthScoreDiff);
    healthScoreDiff.className = 'comparison-value ' + getChangeClass(changes.healthScoreDiff);

    // Metric changes
    updateMetricChange('seo', changes.metricChanges.seo);
    updateMetricChange('performance', changes.metricChanges.performance);
    updateMetricChange('accessibility', changes.metricChanges.accessibility);
    updateMetricChange('security', changes.metricChanges.security);
    updateMetricChange('bestPractices', changes.metricChanges.bestPractices);

    // Issue changes
    document.getElementById('newIssuesCount').textContent = changes.newIssues.length;
    document.getElementById('resolvedIssuesCount').textContent = changes.resolvedIssues.length;

    // Pages crawled difference (if we track this)
    const pagesDiff = 0; // Calculate from audit data if needed
    document.getElementById('pagesCrawledDiff').textContent = allPages.length;
}

function updateMetricChange(metricName, change) {
    const changeElement = document.getElementById(`${metricName}Change`);
    if (changeElement) {
        updateChangeIndicator(changeElement, change);
    }
}

function updateChangeIndicator(element, change) {
    if (change === 0) {
        element.textContent = '';
        element.className = 'metric-change neutral';
    } else if (change > 0) {
        element.textContent = `↑ +${Math.round(change)}`;
        element.className = 'metric-change positive';
    } else {
        element.textContent = `↓ ${Math.round(change)}`;
        element.className = 'metric-change negative';
    }
}

function formatChange(change) {
    if (change === 0) return '→ No change';
    const sign = change > 0 ? '↑' : '↓';
    return `${sign} ${Math.abs(Math.round(change))}`;
}

function getChangeClass(change) {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
}

function updateMetric(name, score) {
    const roundedScore = Math.round(score);
    document.getElementById(`${name}Score`).textContent = roundedScore;
    document.getElementById(`${name}Bar`).style.width = `${roundedScore}%`;
}

function displayIssues(issues) {
    // Fallback to old display method - redirect to grouped display
    displayIssuesGrouped(issues, null);
}

function displayIssuesGrouped(currentIssues, previousIssues) {
    const issuesList = document.getElementById('issuesList');
    const issueCount = document.getElementById('issueCount');

    if (!currentIssues || currentIssues.length === 0) {
        issueCount.textContent = '0';
        issuesList.innerHTML = '<p class="empty-state">No issues found</p>';
        return;
    }

    // Group current issues by category
    const currentGrouped = groupIssuesByCategory(currentIssues);

    // Group previous issues by category (if available)
    const previousGrouped = previousIssues ? groupIssuesByCategory(previousIssues) : {};

    // Filter by severity if needed
    let filteredCategories = Object.keys(currentGrouped);
    if (currentFilter !== 'all') {
        filteredCategories = filteredCategories.filter(category => {
            return currentGrouped[category].some(issue => issue.severity === currentFilter);
        });
    }

    // Count total filtered issues
    let totalIssues = 0;
    filteredCategories.forEach(category => {
        const categoryIssues = currentFilter === 'all'
            ? currentGrouped[category]
            : currentGrouped[category].filter(issue => issue.severity === currentFilter);
        totalIssues += categoryIssues.length;
    });

    issueCount.textContent = totalIssues;

    if (filteredCategories.length === 0) {
        issuesList.innerHTML = '<p class="empty-state">No issues found in this category</p>';
        return;
    }

    // Build grouped HTML
    issuesList.innerHTML = filteredCategories.map(category => {
        const categoryIssues = currentFilter === 'all'
            ? currentGrouped[category]
            : currentGrouped[category].filter(issue => issue.severity === currentFilter);

        const currentCount = categoryIssues.length;
        const previousCount = previousGrouped[category] ? previousGrouped[category].length : null;

        // Determine if improved or deteriorated
        let changeIndicator = '';
        let changeClass = '';
        if (previousCount !== null) {
            const diff = currentCount - previousCount;
            if (diff < 0) {
                // Improved (fewer issues)
                changeIndicator = `<span class="issue-change improved">↓ ${Math.abs(diff)} improved</span>`;
                changeClass = 'improved';
            } else if (diff > 0) {
                // Deteriorated (more issues)
                changeIndicator = `<span class="issue-change deteriorated">↑ ${diff} new</span>`;
                changeClass = 'deteriorated';
            } else {
                changeIndicator = `<span class="issue-change unchanged">→ unchanged</span>`;
                changeClass = 'unchanged';
            }
        }

        // Get severity breakdown
        const severityCounts = {
            critical: categoryIssues.filter(i => i.severity === 'critical').length,
            high: categoryIssues.filter(i => i.severity === 'high').length,
            medium: categoryIssues.filter(i => i.severity === 'medium').length,
            low: categoryIssues.filter(i => i.severity === 'low').length,
        };

        const severityBadges = Object.entries(severityCounts)
            .filter(([_, count]) => count > 0)
            .map(([severity, count]) => `<span class="severity-badge ${severity}">${count} ${severity}</span>`)
            .join('');

        const categoryId = category.replace(/\s+/g, '-').toLowerCase();

        return `
            <div class="issue-group ${changeClass}">
                <div class="issue-group-header" onclick="toggleIssueGroup('${categoryId}')">
                    <div class="issue-group-title">
                        <span class="issue-group-icon">📋</span>
                        <span class="issue-group-name">${escapeHtml(category)}</span>
                        <span class="issue-group-count">${currentCount} issue${currentCount !== 1 ? 's' : ''}</span>
                        ${changeIndicator}
                    </div>
                    <div class="issue-group-severity">
                        ${severityBadges}
                        <span class="issue-group-toggle" id="toggle-${categoryId}">▼</span>
                    </div>
                </div>
                <div class="issue-group-content" id="content-${categoryId}" style="display: none;">
                    ${categoryIssues.map(issue => `
                        <div class="issue-item ${issue.severity}">
                            <div class="issue-header">
                                <span class="issue-title">${escapeHtml(issue.title)}</span>
                                <span class="issue-severity ${issue.severity}">${issue.severity}</span>
                            </div>
                            <div class="issue-description">${escapeHtml(issue.description)}</div>
                            ${issue.element ? `<div class="issue-element">Element: ${escapeHtml(issue.element)}</div>` : ''}
                            <div class="issue-recommendation">💡 ${escapeHtml(issue.recommendation)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function groupIssuesByCategory(issues) {
    const grouped = {};
    issues.forEach(issue => {
        const category = issue.category || 'Other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(issue);
    });
    return grouped;
}

function toggleIssueGroup(groupId) {
    const content = document.getElementById(`content-${groupId}`);
    const toggle = document.getElementById(`toggle-${groupId}`);

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
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
    if (score >= 80) return 'excellent';  // Green
    if (score >= 60) return 'good';       // Orange
    if (score >= 20) return 'fair';       // Yellow
    return 'poor';                         // Red
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
