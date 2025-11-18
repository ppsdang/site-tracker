const API_BASE_URL = window.location.origin + '/api';

let currentFilter = 'all';
let currentAudit = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadRecentWebsites();
    setupEventListeners();
});

function setupEventListeners() {
    // Audit form submission
    document.getElementById('auditForm').addEventListener('submit', handleAuditSubmit);

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
}

async function handleAuditSubmit(e) {
    e.preventDefault();

    const url = document.getElementById('urlInput').value;
    const auditButton = document.getElementById('auditButton');
    const auditProgress = document.getElementById('auditProgress');
    const resultsSection = document.getElementById('resultsSection');

    // Show progress
    auditButton.disabled = true;
    auditButton.textContent = 'Analyzing...';
    auditProgress.style.display = 'block';
    resultsSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/audits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        const result = await response.json();

        if (result.success) {
            currentAudit = result.data;
            displayAuditResults(result.data);
            loadComparison(result.data.id);
            loadRecentWebsites();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to run audit. Please try again.');
    } finally {
        auditButton.disabled = false;
        auditButton.textContent = 'Run Audit';
        auditProgress.style.display = 'none';
    }
}

function displayAuditResults(audit) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';

    // Health score
    const healthScoreValue = document.getElementById('healthScoreValue');
    const healthScoreCircle = document.getElementById('healthScoreCircle');
    healthScoreValue.textContent = audit.healthScore;

    // Set color based on score
    healthScoreCircle.classList.remove('excellent', 'good', 'fair', 'poor');
    if (audit.healthScore >= 90) {
        healthScoreCircle.classList.add('excellent');
    } else if (audit.healthScore >= 75) {
        healthScoreCircle.classList.add('good');
    } else if (audit.healthScore >= 50) {
        healthScoreCircle.classList.add('fair');
    } else {
        healthScoreCircle.classList.add('poor');
    }

    // Individual metrics
    updateMetric('seo', audit.metrics.seo.score);
    updateMetric('performance', audit.metrics.performance.score);
    updateMetric('accessibility', audit.metrics.accessibility.score);
    updateMetric('security', audit.metrics.security.score);
    updateMetric('bestPractices', audit.metrics.bestPractices.score);

    // Issues
    displayIssues(audit.issues);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function updateMetric(name, score) {
    document.getElementById(`${name}Score`).textContent = Math.round(score);
    document.getElementById(`${name}Bar`).style.width = `${score}%`;
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
        issuesList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No issues found in this category</p>';
        return;
    }

    issuesList.innerHTML = filteredIssues.map(issue => `
        <div class="issue-item ${issue.severity}">
            <div class="issue-header">
                <span class="issue-title">${escapeHtml(issue.title)}</span>
                <span class="issue-severity ${issue.severity}">${issue.severity}</span>
            </div>
            <div class="issue-description">${escapeHtml(issue.description)}</div>
            ${issue.element ? `<div style="font-size: 0.9rem; color: #999; margin: 5px 0;">Element: ${escapeHtml(issue.element)}</div>` : ''}
            <div class="issue-recommendation">💡 ${escapeHtml(issue.recommendation)}</div>
        </div>
    `).join('');
}

async function loadComparison(auditId) {
    try {
        const response = await fetch(`${API_BASE_URL}/audits/${auditId}/comparison`);
        const result = await response.json();

        if (result.success && result.data.previous) {
            displayComparison(result.data);
        }
    } catch (error) {
        console.error('Error loading comparison:', error);
    }
}

function displayComparison(comparison) {
    const comparisonSection = document.getElementById('comparisonSection');
    const comparisonContent = document.getElementById('comparisonContent');

    const changes = comparison.changes;

    comparisonContent.innerHTML = `
        <div class="comparison-metrics">
            <div class="comparison-metric">
                <div class="comparison-label">Health Score Change</div>
                <div class="comparison-value ${getChangeClass(changes.healthScoreDiff)}">
                    ${formatChange(changes.healthScoreDiff)}
                </div>
            </div>
            <div class="comparison-metric">
                <div class="comparison-label">SEO</div>
                <div class="comparison-value ${getChangeClass(changes.metricChanges.seo)}">
                    ${formatChange(changes.metricChanges.seo)}
                </div>
            </div>
            <div class="comparison-metric">
                <div class="comparison-label">Performance</div>
                <div class="comparison-value ${getChangeClass(changes.metricChanges.performance)}">
                    ${formatChange(changes.metricChanges.performance)}
                </div>
            </div>
            <div class="comparison-metric">
                <div class="comparison-label">Accessibility</div>
                <div class="comparison-value ${getChangeClass(changes.metricChanges.accessibility)}">
                    ${formatChange(changes.metricChanges.accessibility)}
                </div>
            </div>
            <div class="comparison-metric">
                <div class="comparison-label">Security</div>
                <div class="comparison-value ${getChangeClass(changes.metricChanges.security)}">
                    ${formatChange(changes.metricChanges.security)}
                </div>
            </div>
            <div class="comparison-metric">
                <div class="comparison-label">Best Practices</div>
                <div class="comparison-value ${getChangeClass(changes.metricChanges.bestPractices)}">
                    ${formatChange(changes.metricChanges.bestPractices)}
                </div>
            </div>
        </div>

        ${changes.newIssues.length > 0 ? `
            <div style="margin-top: 20px;">
                <h4 style="color: #e53935;">New Issues (${changes.newIssues.length})</h4>
                <ul style="padding-left: 20px; color: #666;">
                    ${changes.newIssues.slice(0, 5).map(issue =>
                        `<li>${escapeHtml(issue.title)} (${issue.severity})</li>`
                    ).join('')}
                    ${changes.newIssues.length > 5 ? '<li>... and more</li>' : ''}
                </ul>
            </div>
        ` : ''}

        ${changes.resolvedIssues.length > 0 ? `
            <div style="margin-top: 20px;">
                <h4 style="color: #4caf50;">Resolved Issues (${changes.resolvedIssues.length})</h4>
                <ul style="padding-left: 20px; color: #666;">
                    ${changes.resolvedIssues.slice(0, 5).map(issue =>
                        `<li>${escapeHtml(issue.title)} (${issue.severity})</li>`
                    ).join('')}
                    ${changes.resolvedIssues.length > 5 ? '<li>... and more</li>' : ''}
                </ul>
            </div>
        ` : ''}
    `;

    comparisonSection.style.display = 'block';
}

async function loadRecentWebsites() {
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
    const websitesList = document.getElementById('websitesList');

    if (websites.length === 0) {
        websitesList.innerHTML = '<p style="text-align: center; color: #666;">No websites audited yet</p>';
        return;
    }

    // Get latest audits for each website
    Promise.all(
        websites.map(async (website) => {
            try {
                const response = await fetch(`${API_BASE_URL}/websites/${website.id}/latest-audit`);
                const result = await response.json();
                return result.success ? result.data : null;
            } catch (error) {
                return null;
            }
        })
    ).then(audits => {
        websitesList.innerHTML = audits
            .filter(audit => audit !== null)
            .slice(0, 10)
            .map(audit => `
                <div class="website-item" onclick="loadAuditDetails(${audit.id})">
                    <div>
                        <div class="website-url">${escapeHtml(audit.url)}</div>
                        <div style="font-size: 0.85rem; color: #999; margin-top: 5px;">
                            ${formatDate(audit.auditDate)}
                        </div>
                    </div>
                    <div class="website-score">${audit.healthScore}</div>
                </div>
            `).join('');
    });
}

async function loadAuditDetails(auditId) {
    try {
        const response = await fetch(`${API_BASE_URL}/audits/${auditId}`);
        const result = await response.json();

        if (result.success) {
            currentAudit = result.data;
            displayAuditResults(result.data);
            loadComparison(result.data.id);
        }
    } catch (error) {
        console.error('Error loading audit details:', error);
    }
}

function getChangeClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
}

function formatChange(value) {
    const rounded = Math.round(value);
    if (rounded > 0) return `+${rounded}`;
    if (rounded < 0) return `${rounded}`;
    return '0';
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
