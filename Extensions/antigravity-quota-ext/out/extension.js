"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const update_defaults_1 = require("./update-defaults");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_RETRY_MS = 3 * 1000;
const TICK_MS = 5000;
const REQUEST_TIMEOUT_MS = 2500;
const SERVICE_PATH = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const OPEN_FROM_STATUS_COMMAND = 'quota-view.openFromStatusBar';
const UPDATE_CHECK_COMMAND = 'antigravityQuotas.checkForUpdates';
const UPDATE_CONFIGURE_TOKEN_COMMAND = 'antigravityQuotas.configureUpdateToken';
const UPDATE_CLEAR_TOKEN_COMMAND = 'antigravityQuotas.clearUpdateToken';
const UPDATE_SECRET_KEY = 'antigravityQuotas.githubPat';
const DEFAULT_UPDATE_INTERVAL_HOURS = 12;
const GITHUB_API_BASE = 'https://api.github.com';
class ExtensionUpdater {
    constructor(context) {
        this.context = context;
        this.timer = null;
        this.lastNotifiedVersion = null;
        this.checking = false;
        this.extensionVersion = String(context.extension.packageJSON.version ?? '0.0.0');
    }
    dispose() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    start() {
        this.reschedule();
        void this.checkForUpdates('startup');
    }
    onConfigurationChanged(event) {
        if (event.affectsConfiguration('antigravityQuotas.updates')) {
            this.reschedule();
        }
    }
    async configureToken() {
        const token = await vscode.window.showInputBox({
            title: 'Configure GitHub Token',
            prompt: 'Paste your fine-grained read-only GitHub token',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => (value.trim() ? null : 'Token cannot be empty'),
        });
        if (!token)
            return;
        await this.context.secrets.store(UPDATE_SECRET_KEY, token.trim());
        vscode.window.showInformationMessage('Antigravity Quotas update token saved securely.');
    }
    async clearToken() {
        await this.context.secrets.delete(UPDATE_SECRET_KEY);
        vscode.window.showInformationMessage('Antigravity Quotas update token was cleared.');
    }
    async checkForUpdates(trigger) {
        if (this.checking)
            return;
        this.checking = true;
        try {
            const config = this.getConfig();
            if (!config.enabled) {
                if (trigger === 'manual') {
                    vscode.window.showInformationMessage('Antigravity Quotas updates are disabled in settings.');
                }
                return;
            }
            if (!config.githubOwner || !config.githubRepo) {
                if (trigger === 'manual') {
                    vscode.window.showErrorMessage('Update settings are incomplete: GitHub owner/repo are required.');
                }
                return;
            }
            const token = (await this.context.secrets.get(UPDATE_SECRET_KEY))?.trim() || undefined;
            const release = await this.fetchLatestRelease(config, token);
            const remoteVersion = this.extractVersionFromTag(release.tag_name);
            if (!remoteVersion) {
                if (trigger === 'manual') {
                    vscode.window.showWarningMessage(`Could not parse release version from tag "${release.tag_name}".`);
                }
                return;
            }
            if (this.compareSemver(remoteVersion, this.extensionVersion) <= 0) {
                if (trigger === 'manual') {
                    vscode.window.showInformationMessage(`Up to date (${this.extensionVersion}).`);
                }
                return;
            }
            const asset = this.selectVsixAsset(release.assets, config.assetPattern, remoteVersion);
            if (!asset) {
                const action = await vscode.window.showWarningMessage(`Update ${remoteVersion} found, but no VSIX matched pattern "${config.assetPattern}".`, 'View Release');
                if (action === 'View Release') {
                    await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
                }
                return;
            }
            if (trigger !== 'manual' && this.lastNotifiedVersion === remoteVersion) {
                return;
            }
            this.lastNotifiedVersion = remoteVersion;
            const action = await vscode.window.showInformationMessage(`Antigravity Quotas ${remoteVersion} is available.`, 'Install now', 'View release', 'Later');
            if (action === 'View release') {
                await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
                return;
            }
            if (action === 'Install now') {
                await this.installAsset(asset, token);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown update error';
            if (trigger === 'manual') {
                vscode.window.showErrorMessage(`Update check failed: ${message}`);
            }
        }
        finally {
            this.checking = false;
        }
    }
    reschedule() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const config = this.getConfig();
        if (!config.enabled)
            return;
        const intervalMs = config.checkIntervalHours * 60 * 60 * 1000;
        this.timer = setInterval(() => {
            void this.checkForUpdates('interval');
        }, intervalMs);
    }
    getConfig() {
        const cfg = vscode.workspace.getConfiguration('antigravityQuotas');
        const interval = cfg.get('updates.checkIntervalHours', DEFAULT_UPDATE_INTERVAL_HOURS);
        return {
            enabled: cfg.get('updates.enabled', true),
            channel: 'stable',
            checkIntervalHours: Number.isFinite(interval)
                ? Math.max(1, Math.floor(interval))
                : DEFAULT_UPDATE_INTERVAL_HOURS,
            githubOwner: cfg.get('updates.githubOwner', update_defaults_1.DEFAULT_UPDATE_OWNER).trim(),
            githubRepo: cfg.get('updates.githubRepo', update_defaults_1.DEFAULT_UPDATE_REPO).trim(),
            assetPattern: cfg.get('updates.assetPattern', update_defaults_1.DEFAULT_UPDATE_ASSET_PATTERN).trim(),
        };
    }
    async fetchLatestRelease(config, token) {
        const endpoint = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.githubOwner)}/${encodeURIComponent(config.githubRepo)}/releases/latest`;
        const response = await fetch(endpoint, {
            headers: this.getGithubHeaders(token),
        });
        if (response.status === 401 || response.status === 403) {
            throw new Error(token
                ? 'GitHub token is invalid, expired, or missing required read permissions.'
                : 'GitHub denied release access. If this repo is private, configure a read-only token.');
        }
        if (!response.ok) {
            throw new Error(`GitHub release request failed (${response.status}).`);
        }
        return (await response.json());
    }
    async installAsset(asset, token) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing update ${asset.name}`,
        }, async () => {
            const filePath = await this.downloadAsset(asset, token);
            await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(filePath));
        });
        const action = await vscode.window.showInformationMessage('Update installed. Reload window to finish.', 'Reload');
        if (action === 'Reload') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }
    async downloadAsset(asset, token) {
        const response = await fetch(asset.url, {
            headers: {
                ...this.getGithubHeaders(token),
                Accept: 'application/octet-stream',
            },
        });
        if (!response.ok) {
            throw new Error(`VSIX download failed (${response.status}).`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const filePath = path.join(os.tmpdir(), asset.name);
        await fs.writeFile(filePath, bytes);
        return filePath;
    }
    getGithubHeaders(token) {
        return (0, update_defaults_1.buildGithubHeaders)(token);
    }
    extractVersionFromTag(tag) {
        const cleaned = tag.trim().replace(/^v/i, '');
        const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!match)
            return null;
        return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
    }
    compareSemver(a, b) {
        const aParts = a.split('.').map((p) => Number(p));
        const bParts = b.split('.').map((p) => Number(p));
        for (let i = 0; i < 3; i += 1) {
            const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
            if (diff !== 0)
                return diff;
        }
        return 0;
    }
    selectVsixAsset(assets, pattern, remoteVersion) {
        const matcher = this.globToRegExp(pattern || update_defaults_1.DEFAULT_UPDATE_ASSET_PATTERN);
        const candidates = assets.filter((asset) => matcher.test(asset.name));
        if (!candidates.length)
            return null;
        const versionToken = remoteVersion.replace(/\./g, '\\.');
        const exactVersionRegex = new RegExp(versionToken);
        const exact = candidates.find((asset) => exactVersionRegex.test(asset.name));
        if (exact)
            return exact;
        candidates.sort((a, b) => a.name.localeCompare(b.name));
        return candidates[0];
    }
    globToRegExp(pattern) {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(`^${escaped}$`, 'i');
    }
}
class QuotaProvider {
    constructor(extensionUri, statusBarItem) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.output = vscode.window.createOutputChannel('Antigravity Quotas');
        this.nextFetchTime = Date.now();
        this.cachedModels = [];
        this.lastError = null;
        this.refreshing = false;
        this.hasSuccessfulFetch = false;
        this.expandedGroups = new Set();
        this.extensionUri = extensionUri;
        this.statusBarItem = statusBarItem;
        this.statusBarItem.command = OPEN_FROM_STATUS_COMMAND;
        this.statusBarItem.text = '$(dashboard) Quotas';
        this.statusBarItem.tooltip = 'Quotas: loading...';
        this.statusBarItem.show();
        this.ticker = setInterval(() => {
            if (Date.now() >= this.nextFetchTime) {
                void this.refresh();
                return;
            }
            this.updateStatusBar();
            this._onDidChangeTreeData.fire();
        }, TICK_MS);
    }
    dispose() {
        clearInterval(this.ticker);
        this.output.dispose();
        this._onDidChangeTreeData.dispose();
    }
    async manualRefresh() {
        await this.refresh();
    }
    expandAllGroups() {
        this.expandedGroups = new Set(['Gemini', 'Claude', 'GPT-OSS', 'Other']);
        this._onDidChangeTreeData.fire();
    }
    handleVisualSettingsChanged() {
        this.updateStatusBar();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        if (element.kind === 'group') {
            const groupItem = new vscode.TreeItem(`${element.group} (${element.models.length})`, this.expandedGroups.has(element.group)
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed);
            groupItem.iconPath = this.getGroupIconPath(element.group);
            return groupItem;
        }
        if (element.kind === 'model') {
            const label = element.data.percent === null
                ? `${element.data.displayName} - Quota unknown`
                : `${element.data.displayName} - ${element.data.percent}%`;
            const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(this.getTreeSeverityColor(element.data.severity)));
            return item;
        }
        const timerLabel = element.data.resetText || element.data.model.label || '';
        const timerItem = new vscode.TreeItem(element.data.resetText ? `  ${timerLabel}` : timerLabel, vscode.TreeItemCollapsibleState.None);
        timerItem.iconPath = new vscode.ThemeIcon('watch');
        return timerItem;
    }
    async getChildren(element) {
        if (!element) {
            if (!this.cachedModels.length && !this.refreshing) {
                await this.refresh();
            }
            const rootItems = [];
            rootItems.push(...this.getRootStatusNodes());
            rootItems.push(...this.getGroupedNodes());
            return rootItems;
        }
        if (element.kind !== 'group')
            return [];
        const children = [];
        for (const data of element.models) {
            children.push({ kind: 'model', data });
            children.push({ kind: 'timer', data });
        }
        return children;
    }
    async refresh() {
        if (this.refreshing)
            return;
        this.refreshing = true;
        let fetchSucceeded = false;
        this.updateStatusBar();
        this._onDidChangeTreeData.fire();
        try {
            this.cachedModels = await this.fetchQuotas();
            this.lastError = null;
            this.hasSuccessfulFetch = true;
            fetchSucceeded = true;
            this.ensureExpandedGroupsFromData();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown refresh failure';
            if (this.shouldSuppressStartupError(message)) {
                this.lastError = null;
            }
            else {
                this.lastError = message;
                this.output.appendLine(`[refresh] ${message}`);
            }
        }
        finally {
            if (fetchSucceeded) {
                this.nextFetchTime = Date.now() + REFRESH_INTERVAL_MS;
            }
            else if (!this.hasSuccessfulFetch) {
                this.nextFetchTime = Date.now() + STARTUP_RETRY_MS;
            }
            else {
                this.nextFetchTime = Date.now() + REFRESH_INTERVAL_MS;
            }
            this.refreshing = false;
            this.updateStatusBar();
            this._onDidChangeTreeData.fire();
        }
    }
    getRootStatusNodes() {
        const nodes = [];
        const secondsLeft = Math.max(0, Math.floor((this.nextFetchTime - Date.now()) / 1000));
        nodes.push({
            kind: 'timer',
            data: {
                model: {
                    label: `Next poll in: ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`,
                },
                displayName: '',
                percent: null,
                severity: 'unknown',
                resetText: '',
                group: 'Other',
            },
        });
        if (this.refreshing) {
            nodes.push({
                kind: 'timer',
                data: {
                    model: { label: 'Refreshing...' },
                    displayName: '',
                    percent: null,
                    severity: 'unknown',
                    resetText: '',
                    group: 'Other',
                },
            });
        }
        if (this.lastError) {
            nodes.push({
                kind: 'timer',
                data: {
                    model: { label: `Last error: ${this.lastError}` },
                    displayName: '',
                    percent: null,
                    severity: 'unknown',
                    resetText: '',
                    group: 'Other',
                },
            });
        }
        return nodes;
    }
    getGroupedNodes() {
        if (!this.cachedModels.length)
            return [];
        const grouped = new Map();
        for (const model of this.cachedModels) {
            const percent = this.getQuotaPercent(model);
            const data = {
                model,
                displayName: model.label || 'Unnamed model',
                percent,
                severity: this.getSeverity(percent),
                resetText: this.formatResetCountdown(model.quotaInfo?.resetTime),
                group: this.getProviderGroup(model.label),
            };
            const existing = grouped.get(data.group) ?? [];
            existing.push(data);
            grouped.set(data.group, existing);
        }
        const groupNodes = [];
        for (const [group, models] of grouped.entries()) {
            this.applyDisplayNames(group, models);
            if (group === 'Gemini') {
                models.sort((a, b) => this.compareGeminiModels(a, b));
            }
            else {
                models.sort((a, b) => this.comparePercent(a.percent, b.percent) || a.displayName.localeCompare(b.displayName));
            }
            groupNodes.push({ kind: 'group', group, models });
        }
        groupNodes.sort((a, b) => {
            const riskCompare = this.comparePercent(this.getGroupMinPercent(a.models), this.getGroupMinPercent(b.models));
            if (riskCompare !== 0)
                return riskCompare;
            return a.group.localeCompare(b.group);
        });
        return groupNodes;
    }
    ensureExpandedGroupsFromData() {
        if (this.expandedGroups.size > 0)
            return;
        for (const groupNode of this.getGroupedNodes()) {
            this.expandedGroups.add(groupNode.group);
        }
    }
    getProviderGroup(label) {
        const normalized = (label || '').toLowerCase();
        if (normalized.includes('gemini'))
            return 'Gemini';
        if (normalized.includes('claude'))
            return 'Claude';
        if (normalized.includes('gpt-oss') ||
            normalized.includes('gpt oss') ||
            normalized.startsWith('gpt-')) {
            return 'GPT-OSS';
        }
        return 'Other';
    }
    getQuotaPercent(model) {
        const fraction = model.quotaInfo?.remainingFraction;
        if (typeof fraction !== 'number' || !Number.isFinite(fraction))
            return null;
        return Math.max(0, Math.min(100, Math.round(fraction * 100)));
    }
    getSeverity(percent) {
        if (percent === null)
            return 'unknown';
        if (percent >= 75)
            return 'good';
        if (percent >= 40)
            return 'watch';
        if (percent >= 15)
            return 'low';
        return 'critical';
    }
    getTreeSeverityColor(severity) {
        switch (severity) {
            case 'good':
                return 'charts.green';
            case 'watch':
                return 'charts.yellow';
            case 'low':
                return 'notificationsWarningIcon.foreground';
            case 'critical':
                return 'charts.red';
            default:
                return 'charts.foreground';
        }
    }
    getStatusEmoji(severity) {
        switch (severity) {
            case 'good':
                return '\u{1F7E2}';
            case 'watch':
                return '\u{1F7E1}';
            case 'low':
                return '\u{1F7E0}';
            case 'critical':
                return '\u{1F534}';
            default:
                return '\u{26AA}';
        }
    }
    getGroupMinPercent(models) {
        const known = models.map((m) => m.percent).filter((p) => p !== null);
        if (!known.length)
            return null;
        return Math.min(...known);
    }
    comparePercent(a, b) {
        if (a === null && b === null)
            return 0;
        if (a === null)
            return 1;
        if (b === null)
            return -1;
        return a - b;
    }
    getGroupIconStyle() {
        const style = vscode.workspace
            .getConfiguration('antigravityQuotas')
            .get('groupIconStyle', 'color');
        if (style === 'mono' || style === 'auto')
            return style;
        return 'color';
    }
    getGroupIconPath(group) {
        const iconStyle = this.getGroupIconStyle();
        if (group === 'Gemini') {
            return this.getProviderGroupIcon(iconStyle, 'gemini');
        }
        if (group === 'Claude') {
            return this.getProviderGroupIcon(iconStyle, 'claude');
        }
        if (group === 'GPT-OSS') {
            return new vscode.ThemeIcon('hubot');
        }
        return new vscode.ThemeIcon('symbol-misc');
    }
    getProviderGroupIcon(iconStyle, provider) {
        if (iconStyle === 'color') {
            return vscode.Uri.joinPath(this.extensionUri, 'resources', 'icons', `${provider}-color.png`);
        }
        const dark = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icons', provider === 'gemini' ? 'icons8-gemini-ai-96-white.png' : 'icons8-claude-96-white.png');
        const light = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icons', provider === 'gemini' ? 'icons8-gemini-ai-96-black.png' : 'icons8-claude-96-black.png');
        return { light, dark };
    }
    compareGeminiModels(a, b) {
        const versionCompare = this.compareGeminiVersion(a.displayName, b.displayName);
        if (versionCompare !== 0)
            return versionCompare;
        const tierCompare = this.getGeminiTierRank(a.displayName) - this.getGeminiTierRank(b.displayName);
        if (tierCompare !== 0)
            return tierCompare;
        return a.displayName.localeCompare(b.displayName);
    }
    compareGeminiVersion(aName, bName) {
        const a = this.parseGeminiVersion(aName);
        const b = this.parseGeminiVersion(bName);
        if (!a && !b)
            return 0;
        if (!a)
            return 1;
        if (!b)
            return -1;
        if (a.major !== b.major)
            return b.major - a.major;
        if (a.minor !== b.minor)
            return b.minor - a.minor;
        return 0;
    }
    parseGeminiVersion(name) {
        const match = name.match(/(\d+)(?:\.(\d+))?/);
        if (!match)
            return null;
        return {
            major: Number(match[1]),
            minor: Number(match[2] ?? '0'),
        };
    }
    getGeminiTierRank(name) {
        const normalized = name.toLowerCase();
        if (normalized.includes('high'))
            return 0;
        if (normalized.includes('low'))
            return 1;
        if (normalized.includes('fast') || normalized.includes('flash'))
            return 2;
        return 3;
    }
    shouldSuppressStartupError(message) {
        if (this.cachedModels.length > 0)
            return false;
        return message.includes('Could not find Antigravity language server process');
    }
    applyDisplayNames(group, models) {
        const parts = models.map((m) => this.getShortNameParts(group, m.model.label || 'Unnamed model'));
        const baseCounts = new Map();
        for (const part of parts) {
            const key = part.base.toLowerCase();
            baseCounts.set(key, (baseCounts.get(key) ?? 0) + 1);
        }
        for (let i = 0; i < models.length; i += 1) {
            const part = parts[i];
            const hasCollision = (baseCounts.get(part.base.toLowerCase()) ?? 0) > 1;
            models[i].displayName =
                hasCollision && part.suffix ? `${part.base} (${part.suffix})` : part.base;
        }
    }
    getShortNameParts(group, originalLabel) {
        let label = originalLabel.trim();
        if (group === 'Claude') {
            label = label.replace(/^claude\s+/i, '').trim();
        }
        else if (group === 'Gemini') {
            label = label.replace(/^gemini\s+/i, '').trim();
        }
        else if (group === 'GPT-OSS') {
            label = label.replace(/^gpt-oss\s+/i, '').trim();
            label = label.replace(/^gpt\s*-\s*/i, '').trim();
        }
        const suffixMatch = label.match(/\(([^)]+)\)\s*$/);
        const suffix = suffixMatch?.[1]?.trim() || null;
        const base = suffixMatch ? label.slice(0, suffixMatch.index).trim() : label;
        return {
            base: base || label || 'Unnamed model',
            suffix,
        };
    }
    updateStatusBar() {
        const allModels = this.getGroupedNodes().flatMap((g) => g.models);
        if (this.refreshing) {
            this.statusBarItem.text = '$(dashboard) Quotas $(sync~spin)';
        }
        else {
            this.statusBarItem.text = '$(dashboard) Quotas';
        }
        if (!allModels.length) {
            this.statusBarItem.tooltip = this.lastError
                ? `Quotas\n\nLast error: ${this.lastError}`
                : this.hasSuccessfulFetch
                    ? 'Quotas\n\nNo quota data yet'
                    : 'Quotas\n\nLoading quotas...';
            this.statusBarItem.color = undefined;
            return;
        }
        const lowest = allModels.reduce((acc, curr) => {
            if (acc.percent === null)
                return curr;
            if (curr.percent === null)
                return acc;
            return curr.percent < acc.percent ? curr : acc;
        });
        const lowestSeverity = this.getSeverity(lowest.percent);
        if (lowestSeverity === 'critical') {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        }
        else if (lowestSeverity === 'low' || lowestSeverity === 'watch') {
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        }
        else {
            this.statusBarItem.color = undefined;
        }
        const lines = ['Quotas', ''];
        const grouped = this.getGroupedNodes();
        for (const group of grouped) {
            lines.push(group.group);
            for (const model of group.models) {
                const percentText = model.percent === null ? 'Unknown' : `${model.percent}%`;
                lines.push(`  ${this.getStatusEmoji(model.severity)} ${model.displayName}: ${percentText}`);
            }
            lines.push('');
        }
        lines.push('Click to open quota panel');
        this.statusBarItem.tooltip = lines.join('\n');
    }
    formatResetCountdown(resetTime) {
        if (!resetTime)
            return 'Refreshes: N/A';
        const resetAt = new Date(resetTime).getTime();
        if (!Number.isFinite(resetAt))
            return 'Refreshes: N/A';
        const diffMs = resetAt - Date.now();
        if (diffMs <= 0)
            return 'Refreshes soon';
        const totalMinutes = Math.ceil(diffMs / (60 * 1000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            return `Refreshes in ${hours} ${hours === 1 ? 'hour' : 'hours'}, ${minutes} min`;
        }
        return `Refreshes in ${minutes} min`;
    }
    async fetchQuotas() {
        const candidates = await this.discoverCandidates();
        if (!candidates.length) {
            throw new Error('Could not find Antigravity language server process');
        }
        for (const candidate of candidates) {
            for (const port of candidate.ports) {
                const data = await this.tryFetchStatus(port, candidate.csrf);
                if (data?.length)
                    return data;
            }
        }
        throw new Error('Could not fetch quota data from local language server');
    }
    async discoverCandidates() {
        if (process.platform === 'win32') {
            return this.discoverCandidatesWindows();
        }
        return this.discoverCandidatesPosix();
    }
    async discoverCandidatesWindows() {
        const psCommand = "$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match 'language_server' };" +
            '$p | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress';
        const { stdout } = await execAsync(`powershell -NoProfile -Command \"${psCommand}\"`);
        const parsed = this.parseJsonArray(stdout);
        const candidates = [];
        for (const proc of parsed) {
            const csrf = this.extractCsrf(proc.CommandLine || '');
            if (!csrf)
                continue;
            const ports = await this.getPortsWindows(proc.ProcessId);
            if (ports.length) {
                candidates.push({ pid: proc.ProcessId, csrf, ports });
            }
        }
        return candidates;
    }
    async getPortsWindows(pid) {
        const command = `Get-NetTCPConnection -State Listen -OwningProcess ${pid} -ErrorAction SilentlyContinue | ` +
            'Select-Object -ExpandProperty LocalPort | Sort-Object -Unique | ConvertTo-Json -Compress';
        const { stdout } = await execAsync(`powershell -NoProfile -Command \"${command}\"`);
        return this.parseJsonArray(stdout)
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v > 0);
    }
    async discoverCandidatesPosix() {
        const { stdout } = await execAsync('ps -ax -o pid=,command= | grep language_server | grep -v grep');
        const lines = stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const candidates = [];
        for (const line of lines) {
            const pid = Number(line.split(/\s+/)[0]);
            if (!Number.isInteger(pid))
                continue;
            const csrf = this.extractCsrf(line);
            if (!csrf)
                continue;
            const { stdout: lsofOut } = await execAsync(`lsof -nP -a -p ${pid} -iTCP -sTCP:LISTEN`);
            const ports = [
                ...new Set(Array.from(lsofOut.matchAll(/:(\d+)\s+\(LISTEN\)/g)).map((m) => Number(m[1]))),
            ].filter((v) => Number.isInteger(v) && v > 0);
            if (ports.length) {
                candidates.push({ pid, csrf, ports });
            }
        }
        return candidates;
    }
    extractCsrf(commandLine) {
        return (commandLine.match(/--csrf_token\s+([^\s]+)/)?.[1] ||
            commandLine.match(/--csrf_token=([^\s]+)/)?.[1] ||
            '');
    }
    async tryFetchStatus(port, csrf) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(`http://127.0.0.1:${port}${SERVICE_PATH}`, {
                method: 'POST',
                headers: {
                    'X-Codeium-Csrf-Token': csrf,
                    'Connect-Protocol-Version': '1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    metadata: {
                        ideName: 'antigravity',
                        extensionName: 'antigravity',
                        locale: 'en',
                    },
                }),
                signal: controller.signal,
            });
            if (!res.ok)
                return null;
            const payload = (await res.json());
            return payload.userStatus?.cascadeModelConfigData?.clientModelConfigs ?? null;
        }
        catch {
            return null;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    parseJsonArray(raw) {
        const trimmed = raw.trim();
        if (!trimmed)
            return [];
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
        }
        catch {
            return [];
        }
    }
}
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99999);
    const provider = new QuotaProvider(context.extensionUri, statusBarItem);
    const updater = new ExtensionUpdater(context);
    context.subscriptions.push(provider);
    context.subscriptions.push(updater);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('quota-view', provider));
    context.subscriptions.push(vscode.commands.registerCommand('quota-view.refreshEntry', () => provider.manualRefresh()));
    context.subscriptions.push(vscode.commands.registerCommand(OPEN_FROM_STATUS_COMMAND, async () => {
        provider.expandAllGroups();
        await vscode.commands.executeCommand('workbench.view.extension.antigravity-quotas');
        await vscode.commands.executeCommand('quota-view.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand(UPDATE_CHECK_COMMAND, () => updater.checkForUpdates('manual')));
    context.subscriptions.push(vscode.commands.registerCommand(UPDATE_CONFIGURE_TOKEN_COMMAND, () => updater.configureToken()));
    context.subscriptions.push(vscode.commands.registerCommand(UPDATE_CLEAR_TOKEN_COMMAND, () => updater.clearToken()));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('antigravityQuotas.groupIconStyle')) {
            provider.handleVisualSettingsChanged();
        }
        updater.onConfigurationChanged(event);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(() => {
        provider.handleVisualSettingsChanged();
    }));
    void provider.manualRefresh();
    updater.start();
}
function deactivate() {
    // no-op
}
//# sourceMappingURL=extension.js.map