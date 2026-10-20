import axios from 'axios';

/**
 * GitHub MCP Service
 * Implements Model Context Protocol tools for GitHub integration:
 * - testConnection: verifies PAT & returns authenticated user profile
 * - listRepositories: lists user's accessible repositories
 * - getRepository: gets repository details
 * - listCommits: inspects recent commit history
 * - getFileContent: fetches and decodes file content
 * - commitFileChange: creates or updates a file (commits changes via AI)
 * - listIssues: inspects repository issues
 * - createIssue: creates a new GitHub issue
 * - listPullRequests: inspects repository pull requests
 */

const GITHUB_API_BASE = 'https://api.github.com';

function getGitHubHeaders(token) {
  if (!token) {
    throw new Error('GitHub Personal Access Token (PAT) is required');
  }
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'TeacherLuna-AI-MCP/1.0',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

/**
 * Test GitHub connection and retrieve user profile
 */
export async function testGitHubConnection(token) {
  try {
    const res = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
      timeout: 10000
    });
    return {
      success: true,
      user: {
        login: res.data.login,
        name: res.data.name || res.data.login,
        avatar_url: res.data.avatar_url,
        html_url: res.data.html_url,
        public_repos: res.data.public_repos,
        total_private_repos: res.data.total_private_repos || 0,
        scopes: res.headers['x-oauth-scopes'] || 'repo, user'
      }
    };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    return {
      success: false,
      error: status === 401 ? 'Invalid or expired GitHub Personal Access Token' : `GitHub API error: ${msg}`,
      status
    };
  }
}

/**
 * List repositories for the authenticated user
 */
export async function listUserRepositories(token, limit = 10, visibility = 'all') {
  try {
    const res = await axios.get(`${GITHUB_API_BASE}/user/repos`, {
      headers: getGitHubHeaders(token),
      params: {
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(limit, 30),
        visibility
      },
      timeout: 10000
    });
    const repos = res.data.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: r.owner.login,
      private: r.private,
      html_url: r.html_url,
      description: r.description,
      language: r.language,
      default_branch: r.default_branch,
      updated_at: r.updated_at,
      stargazers_count: r.stargazers_count,
      open_issues_count: r.open_issues_count
    }));
    return { success: true, count: repos.length, repos };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * Get single repository details
 */
export async function getRepository(token, owner, repo) {
  try {
    const res = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getGitHubHeaders(token),
      timeout: 10000
    });
    const r = res.data;
    return {
      success: true,
      repo: {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        owner: r.owner.login,
        private: r.private,
        html_url: r.html_url,
        description: r.description,
        default_branch: r.default_branch,
        stars: r.stargazers_count,
        forks: r.forks_count,
        open_issues: r.open_issues_count,
        language: r.language
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * List recent commits from a repository
 */
export async function listCommits(token, owner, repo, limit = 5, branch) {
  try {
    const params = { per_page: Math.min(limit, 20) };
    if (branch) params.sha = branch;

    const res = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits`, {
      headers: getGitHubHeaders(token),
      params,
      timeout: 10000
    });

    const commits = res.data.map(c => ({
      sha: c.sha,
      short_sha: c.sha.substring(0, 7),
      message: c.commit.message,
      author: c.commit.author?.name || c.author?.login,
      date: c.commit.author?.date,
      html_url: c.html_url
    }));

    return { success: true, count: commits.length, commits };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * Get file content from repository
 */
export async function getFileContent(token, owner, repo, filePath, branch) {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    const params = branch ? { ref: branch } : {};

    const res = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`, {
      headers: getGitHubHeaders(token),
      params,
      timeout: 10000
    });

    if (res.data.type !== 'file') {
      return {
        success: false,
        error: `Path '${cleanPath}' is a ${res.data.type}, not a file.`
      };
    }

    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return {
      success: true,
      name: res.data.name,
      path: res.data.path,
      sha: res.data.sha,
      size: res.data.size,
      html_url: res.data.html_url,
      content
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

/**
 * Commit a file change (Create or Update) via AI
 * If file already exists, retrieves SHA and updates. If new, creates file.
 */
export async function commitFileChange(token, owner, repo, filePath, content, commitMessage, branch) {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    const message = commitMessage || `Update ${cleanPath} via Teacher Luna AI`;
    
    // 1. Check if file already exists to obtain current SHA
    let existingSha = null;
    try {
      const existing = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`, {
        headers: getGitHubHeaders(token),
        params: branch ? { ref: branch } : {},
        timeout: 8000
      });
      if (existing.data && existing.data.sha) {
        existingSha = existing.data.sha;
      }
    } catch (checkErr) {
      // 404 is normal for new files
      if (checkErr.response?.status !== 404) {
        console.warn('File existence check warning:', checkErr.message);
      }
    }

    // 2. Commit file content via PUT
    const payload = {
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: branch || undefined
    };
    if (existingSha) {
      payload.sha = existingSha;
    }

    const res = await axios.put(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`, payload, {
      headers: getGitHubHeaders(token),
      timeout: 15000
    });

    const commitData = res.data;
    return {
      success: true,
      action: existingSha ? 'updated' : 'created',
      path: cleanPath,
      commit: {
        sha: commitData.commit?.sha,
        short_sha: commitData.commit?.sha ? commitData.commit.sha.substring(0, 7) : 'latest',
        message: commitData.commit?.message,
        html_url: commitData.commit?.html_url
      },
      content: {
        name: commitData.content?.name,
        path: commitData.content?.path,
        html_url: commitData.content?.html_url
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message,
      status: err.response?.status
    };
  }
}

/**
 * List repository issues
 */
export async function listIssues(token, owner, repo, state = 'open', limit = 5) {
  try {
    const res = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
      headers: getGitHubHeaders(token),
      params: { state, per_page: Math.min(limit, 20) },
      timeout: 10000
    });

    // Exclude pull requests (GitHub API returns PRs in issues endpoint)
    const issues = res.data
      .filter(item => !item.pull_request)
      .map(i => ({
        id: i.id,
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user.login,
        created_at: i.created_at,
        html_url: i.html_url,
        comments: i.comments,
        labels: i.labels.map(l => l.name)
      }));

    return { success: true, count: issues.length, issues };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * Create a new repository issue
 */
export async function createIssue(token, owner, repo, title, body, labels = []) {
  try {
    const res = await axios.post(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
      title,
      body,
      labels
    }, {
      headers: getGitHubHeaders(token),
      timeout: 10000
    });

    return {
      success: true,
      issue: {
        number: res.data.number,
        title: res.data.title,
        html_url: res.data.html_url,
        state: res.data.state,
        created_at: res.data.created_at
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * List repository pull requests
 */
export async function listPullRequests(token, owner, repo, state = 'open', limit = 5) {
  try {
    const res = await axios.get(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, {
      headers: getGitHubHeaders(token),
      params: { state, per_page: Math.min(limit, 20) },
      timeout: 10000
    });

    const pulls = res.data.map(p => ({
      id: p.id,
      number: p.number,
      title: p.title,
      state: p.state,
      user: p.user.login,
      created_at: p.created_at,
      html_url: p.html_url,
      branch: p.head.ref,
      base: p.base.ref
    }));

    return { success: true, count: pulls.length, pulls };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}
