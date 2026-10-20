import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  ShieldCheck, 
  Terminal, 
  GitBranch, 
  Mail, 
  Cable, 
  ExternalLink, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  Sparkles, 
  Send, 
  FolderGit2, 
  GitCommit, 
  FileCode,
  Layers,
  HelpCircle,
  Trash2
} from 'lucide-react';

// Custom Official GitHub Octocat SVG
function GithubIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function McpSettingsModal({ 
  isOpen, 
  onClose, 
  studentId = 'student-demo-1',
  onExecuteToolInChat 
}) {
  const [activeTab, setActiveTab] = useState('github'); // 'github' | 'gmail'
  const [loading, setLoading] = useState(false);
  const [testingGithub, setTestingGithub] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form states
  const [githubToken, setGithubToken] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [defaultOwner, setDefaultOwner] = useState('');
  const [defaultRepo, setDefaultRepo] = useState('');

  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [gmailOAuthToken, setGmailOAuthToken] = useState('');
  const [showOAuthField, setShowOAuthField] = useState(false);

  // Server state
  const [config, setConfig] = useState({
    github: { connected: false, tokenMasked: '', defaultOwner: '', defaultRepo: '', user: null },
    gmail: { connected: false, email: '', hasPassword: false, hasOAuth: false }
  });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mcp/config?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        if (data.config.github?.defaultOwner) setDefaultOwner(data.config.github.defaultOwner);
        if (data.config.github?.defaultRepo) setDefaultRepo(data.config.github.defaultRepo);
        if (data.config.gmail?.email) setGmailEmail(data.config.gmail.email);
      }
    } catch (err) {
      console.error('Failed to load MCP config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setStatusMessage(null);
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const handleTestGithub = async () => {
    setTestingGithub(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/mcp/github/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          token: githubToken || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `GitHub connected successfully! Authenticated as @${data.user?.login} (${data.user?.public_repos} repos)`
        });
        await fetchConfig();
        setGithubToken('');
      } else {
        setStatusMessage({
          type: 'error',
          text: `GitHub Connection failed: ${data.error}`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setTestingGithub(false);
    }
  };

  const handleTestGmail = async () => {
    setTestingGmail(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/mcp/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          email: gmailEmail || undefined,
          appPassword: gmailAppPassword || undefined,
          oauthToken: gmailOAuthToken || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Gmail connected successfully! Verified credentials for ${data.email || gmailEmail}.`
        });
        await fetchConfig();
        setGmailAppPassword('');
        setGmailOAuthToken('');
      } else {
        setStatusMessage({
          type: 'error',
          text: `Gmail Connection failed: ${data.error}`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setTestingGmail(false);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const payload = {
        studentId,
        github: {
          token: githubToken || undefined,
          defaultOwner: defaultOwner || undefined,
          defaultRepo: defaultRepo || undefined
        },
        gmail: {
          email: gmailEmail || undefined,
          appPassword: gmailAppPassword || undefined,
          oauthToken: gmailOAuthToken || undefined
        }
      };

      const res = await fetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setStatusMessage({
          type: 'success',
          text: 'MCP configuration saved successfully!'
        });
        setGithubToken('');
        setGmailAppPassword('');
        setGmailOAuthToken('');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save configuration' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!window.confirm('Disconnect GitHub and remove your stored token?')) return;
    try {
      const res = await fetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          github: { token: '', connected: false, defaultOwner: '', defaultRepo: '' }
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setStatusMessage({ type: 'success', text: 'GitHub MCP disconnected.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm('Disconnect Gmail and remove your stored credentials?')) return;
    try {
      const res = await fetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          gmail: { email: '', appPassword: '', oauthToken: '', connected: false }
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setStatusMessage({ type: 'success', text: 'Gmail MCP disconnected.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0B0F19] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-[#0E1526] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
              <Cable className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Model Context Protocol (MCP) Hub</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  AI Integrations
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Provide tokens for GitHub & Gmail so Teacher Luna can check, commit, and manage changes via AI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="flex-1 font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-[#070B14]">
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'github'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
            }`}
          >
            <GithubIcon className="w-4 h-4" />
            <span>GitHub MCP</span>
            {config.github?.connected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-600" title="Not connected" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'gmail'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail MCP</span>
            {config.gmail?.connected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-600" title="Not connected" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* GITHUB TAB */}
          {activeTab === 'github' && (
            <div className="space-y-4 text-xs">
              
              {/* Connection Status Pill */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                config.github?.connected
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-gray-900/60 border-gray-800 text-gray-300'
              }`}>
                <div className="flex items-center gap-3">
                  {config.github?.user?.avatar_url ? (
                    <img 
                      src={config.github.user.avatar_url} 
                      alt="GitHub avatar" 
                      className="w-9 h-9 rounded-full ring-2 ring-emerald-500/50" 
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                      <GithubIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>{config.github?.connected ? `Connected as @${config.github?.user?.login || 'User'}` : 'GitHub Disconnected'}</span>
                      {config.github?.connected && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {config.github?.connected 
                        ? `Token configured (${config.github.tokenMasked || 'Active'}). Ready to check & commit via AI.`
                        : 'Provide a Personal Access Token (PAT) with repo permissions to enable AI commits.'}
                    </div>
                  </div>
                </div>

                {config.github?.connected && (
                  <button
                    onClick={handleDisconnectGithub}
                    className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-300 transition-colors"
                    title="Disconnect GitHub"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Form: GitHub Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-gray-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Personal Access Token (PAT)</span>
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Teacher+Luna+MCP"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-2"
                  >
                    <span>Generate token on GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                
                <div className="relative">
                  <input
                    type={showGithubToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder={config.github?.tokenMasked ? `Saved (${config.github.tokenMasked}) — enter new token to update` : 'ghp_... or github_pat_...'}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Required scopes: <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">repo</code> (Full control of private and public repositories).
                </p>
              </div>

              {/* Form: Default Repository */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-200">Default Owner / Username</label>
                  <input
                    type="text"
                    value={defaultOwner}
                    onChange={(e) => setDefaultOwner(e.target.value)}
                    placeholder="e.g. octocat"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-gray-200">Default Repository Name</label>
                  <input
                    type="text"
                    value={defaultRepo}
                    onChange={(e) => setDefaultRepo(e.target.value)}
                    placeholder="e.g. learning-tracker"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleTestGithub}
                  disabled={testingGithub || (!githubToken && !config.github?.hasToken)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${testingGithub ? 'animate-spin' : ''}`} />
                  <span>{testingGithub ? 'Testing...' : 'Test & Verify GitHub'}</span>
                </button>
              </div>

              {/* Quick AI Prompts for GitHub */}
              {config.github?.connected && (
                <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Quick AI Actions (Click to Test in Chat)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        if (onExecuteToolInChat) onExecuteToolInChat('Check my GitHub repositories');
                      }}
                      className="p-2.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-left transition-colors flex items-center gap-2 text-gray-200 hover:border-cyan-500/40"
                    >
                      <FolderGit2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="font-medium text-[11px]">List My Repos</div>
                        <div className="text-[10px] text-gray-400">View accessible projects</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        if (onExecuteToolInChat) {
                          const repoPrompt = defaultRepo ? `Show recent commits for ${defaultRepo}` : 'Show recent commits';
                          onExecuteToolInChat(repoPrompt);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-left transition-colors flex items-center gap-2 text-gray-200 hover:border-cyan-500/40"
                    >
                      <GitCommit className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-medium text-[11px]">Recent Commits</div>
                        <div className="text-[10px] text-gray-400">Inspect git history</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        if (onExecuteToolInChat) {
                          const commitPrompt = defaultRepo 
                            ? `Commit file notes.py in repo ${defaultRepo} with content: print('Learned Machine Learning with Teacher Luna') and commit message: Added study notes` 
                            : `Commit file notes.py with content: print('Study Complete')`;
                          onExecuteToolInChat(commitPrompt);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-left transition-colors flex items-center gap-2 text-gray-200 hover:border-cyan-500/40"
                    >
                      <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="font-medium text-[11px]">Commit Via AI</div>
                        <div className="text-[10px] text-gray-400">Push changes via Luna</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* GMAIL TAB */}
          {activeTab === 'gmail' && (
            <div className="space-y-4 text-xs">
              
              {/* Connection Status Pill */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                config.gmail?.connected
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-gray-900/60 border-gray-800 text-gray-300'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    config.gmail?.connected ? 'bg-indigo-900/50 text-indigo-300 ring-2 ring-emerald-500/50' : 'bg-gray-800 text-gray-400'
                  }`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>{config.gmail?.connected ? `Connected: ${config.gmail.email}` : 'Gmail Disconnected'}</span>
                      {config.gmail?.connected && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {config.gmail?.connected 
                        ? 'Authenticated via SMTP/IMAP. Ready to check inbox & send emails.'
                        : 'Connect via Google App Password to enable AI email dispatch and inbox checking.'}
                    </div>
                  </div>
                </div>

                {config.gmail?.connected && (
                  <button
                    onClick={handleDisconnectGmail}
                    className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-300 transition-colors"
                    title="Disconnect Gmail"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Google App Password Guide Card */}
              <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl space-y-2 text-gray-300">
                <div className="font-medium text-gray-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>How to generate a Google App Password (Takes 1 minute):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-400 pl-1">
                  <li>Visit <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-cyan-400 underline">myaccount.google.com/security</a> and make sure <b>2-Step Verification</b> is turned ON.</li>
                  <li>Click or search for <b>App passwords</b> (or visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-cyan-400 underline">myaccount.google.com/apppasswords</a>).</li>
                  <li>Enter app name <b>Teacher Luna</b> and click <b>Create</b>.</li>
                  <li>Copy the generated 16-character code (e.g. <code className="bg-gray-800 px-1 py-0.5 rounded text-amber-300">abcd efgh ijkl mnop</code>) and paste it below.</li>
                </ol>
              </div>

              {/* Form: Gmail Address */}
              <div className="space-y-1.5">
                <label className="font-medium text-gray-200">Gmail Address</label>
                <input
                  type="email"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  placeholder="your-email@gmail.com"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Form: App Password */}
              <div className="space-y-1.5">
                <label className="font-medium text-gray-200 flex items-center justify-between">
                  <span>16-Character Google App Password</span>
                  {config.gmail?.hasPassword && (
                    <span className="text-[10px] text-emerald-400 font-normal">● Saved in secure local store</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showGmailPassword ? 'text' : 'password'}
                    value={gmailAppPassword}
                    onChange={(e) => setGmailAppPassword(e.target.value)}
                    placeholder={config.gmail?.hasPassword ? '•••••••••••••••• (Leave blank to keep existing)' : 'abcd efgh ijkl mnop'}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGmailPassword(!showGmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showGmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Advanced OAuth Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowOAuthField(!showOAuthField)}
                  className="text-[11px] text-gray-400 hover:text-gray-200 underline"
                >
                  {showOAuthField ? '▲ Hide Advanced OAuth Token Option' : '▼ Or use Google OAuth Bearer Token instead'}
                </button>
                {showOAuthField && (
                  <div className="mt-2 space-y-1">
                    <label className="font-medium text-gray-300">Google OAuth Access Token</label>
                    <input
                      type="password"
                      value={gmailOAuthToken}
                      onChange={(e) => setGmailOAuthToken(e.target.value)}
                      placeholder="ya29.a0AfH6..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleTestGmail}
                  disabled={testingGmail || (!gmailEmail && !config.gmail?.email)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${testingGmail ? 'animate-spin' : ''}`} />
                  <span>{testingGmail ? 'Verifying...' : 'Test & Verify Gmail'}</span>
                </button>
              </div>

              {/* Quick AI Prompts for Gmail */}
              {config.gmail?.connected && (
                <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Quick AI Actions (Click to Test in Chat)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        if (onExecuteToolInChat) onExecuteToolInChat('Check my recent emails from Gmail inbox');
                      }}
                      className="p-2.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-left transition-colors flex items-center gap-2 text-gray-200 hover:border-indigo-500/40"
                    >
                      <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-medium text-[11px]">Check Inbox</div>
                        <div className="text-[10px] text-gray-400">Read recent emails via AI</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        if (onExecuteToolInChat) {
                          onExecuteToolInChat(`Send email to ${gmailEmail} with subject Learning Progress Update and body Hello! I am learning with Teacher Luna AI Study Mentor.`);
                        }
                      }}
                      className="p-2.5 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 border border-gray-800 text-left transition-colors flex items-center gap-2 text-gray-200 hover:border-indigo-500/40"
                    >
                      <Send className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-medium text-[11px]">Send Self Update</div>
                        <div className="text-[10px] text-gray-400">Dispatch test progress email</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0E1526] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Credentials saved locally in <code className="text-gray-300">store.json</code> (protected by <code className="text-gray-300">.gitignore</code>)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
