import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath, override: true });

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// High-quality curated educational fallbacks for key AI/ML topics
const CURATED_RESOURCES = {
  'Random Forest': [
    {
      title: 'Random Forests Classification Algorithm - Scikit-Learn Documentation',
      link: 'https://scikit-learn.org/stable/modules/ensemble.html#forest',
      snippet: 'Official guide on ensemble bagging, out-of-bag error estimation, and hyperparameter tuning for RandomForestClassifier.',
      source: 'Scikit-Learn Docs',
      type: 'Official Docs'
    },
    {
      title: 'StatQuest: Random Forests Part 1 - Building, Using and Evaluating',
      link: 'https://www.youtube.com/watch?v=J4Wdy0Wc_xQ',
      snippet: 'Visual step-by-step breakdown of how bootstrap samples and random feature subsets build robust decision forests.',
      source: 'YouTube / StatQuest',
      type: 'Video'
    },
    {
      title: 'Understanding Random Forest Hyperparameters - Towards Data Science',
      link: 'https://towardsdatascience.com/understanding-random-forest-58381e0602d2',
      snippet: 'Deep dive into n_estimators, max_depth, min_samples_split, and class_weight parameters.',
      source: 'Medium / TDS',
      type: 'Article'
    }
  ],
  'Decision Trees': [
    {
      title: 'Decision Trees in Python - Scikit-Learn Documentation',
      link: 'https://scikit-learn.org/stable/modules/tree.html',
      snippet: 'Comprehensive guide covering Gini impurity, Shannon entropy, cost complexity pruning, and tree visualization.',
      source: 'Scikit-Learn Docs',
      type: 'Official Docs'
    },
    {
      title: 'StatQuest: Decision Trees clearly explained',
      link: 'https://www.youtube.com/watch?v=7VeUPuFGJHk',
      snippet: 'Intuitive tutorial on how decision trees partition continuous and categorical features.',
      source: 'YouTube / StatQuest',
      type: 'Video'
    }
  ],
  'Linear Regression': [
    {
      title: 'Stanford CS229: Supervised Learning & Linear Regression Lecture Notes',
      link: 'https://cs229.stanford.edu/main_notes.pdf',
      snippet: 'Rigorous derivation of the Normal Equations, gradient descent convergence proofs, and probabilistic interpretation.',
      source: 'Stanford University',
      type: 'Lecture Notes'
    }
  ],
  'Transformers & Self-Attention': [
    {
      title: 'Attention Is All You Need - Vaswani et al. (Original Paper)',
      link: 'https://arxiv.org/abs/1706.03762',
      snippet: 'The seminal 2017 paper proposing the Transformer model based solely on attention mechanisms.',
      source: 'arXiv.org',
      type: 'Research Paper'
    },
    {
      title: 'The Illustrated Transformer - Jay Alammar',
      link: 'https://jalammar.github.io/illustrated-transformer/',
      snippet: 'Visual step-by-step guide explaining query, key, value vectors and multi-head attention.',
      source: 'Visual Guide',
      type: 'Visual Tutorial'
    }
  ]
};

/**
 * Fetch educational resources for a given topic via SerpApi or curated database
 */
export async function fetchTopicResources(query = 'Machine Learning') {
  if (SERPAPI_KEY && SERPAPI_KEY !== 'your_serpapi_key') {
    try {
      const response = await axios.get('https://serpapi.com/search.json', {
        params: {
          q: `${query} tutorial documentation exercise python`,
          engine: 'google',
          api_key: SERPAPI_KEY,
          num: 6,
        },
        timeout: 5000,
      });

      const organicResults = response.data?.organic_results || [];
      if (organicResults.length > 0) {
        return organicResults.slice(0, 5).map((r) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          source: r.displayed_link || 'Google Search',
          type: r.link.includes('youtube.com') ? 'Video' : 'Article',
        }));
      }
    } catch (err) {
      console.warn('SerpApi call failed or timed out, using curated educational fallbacks:', err.message);
    }
  }

  // Check matching curated resources
  for (const [key, items] of Object.entries(CURATED_RESOURCES)) {
    if (query.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(query.toLowerCase())) {
      return items;
    }
  }

  // General curated fallback
  return [
    {
      title: `${query} - Official Interactive Documentation & API`,
      link: `https://www.google.com/search?q=${encodeURIComponent(query + ' documentation tutorial')}`,
      snippet: `In-depth documentation, code examples, best practices, and interactive exercises for ${query}.`,
      source: 'Open Learning Portal',
      type: 'Documentation'
    },
    {
      title: `Hands-on ${query} Implementation and Best Practices`,
      link: `https://github.com/search?q=${encodeURIComponent(query + ' machine learning tutorial')}`,
      snippet: `Open-source Jupyter notebooks and clean Python implementations for ${query}.`,
      source: 'GitHub / Educational',
      type: 'Code Repository'
    },
    {
      title: `Deep-Dive Video Tutorial: ${query}`,
      link: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' explained machine learning')}`,
      snippet: `Visual explanations, derivations, and coding demonstrations by expert instructors.`,
      source: 'YouTube Education',
      type: 'Video'
    }
  ];
}

/**
 * Live Google Search query via SerpApi with clean format for AI synthesis and RAG context
 * Accurately retrieves latest news, recent updates, and technical guides.
 */
export async function searchWebKnowledge(query, limit = 5) {
  const cleanQ = (query || '').replace(/[?.,!]/g, '').trim();
  const searchTerms = cleanQ.length > 80 ? cleanQ.split(/\s+/).slice(0, 10).join(' ') : cleanQ;

  const keyToUse = SERPAPI_KEY;

  if (keyToUse && !keyToUse.includes('your_') && keyToUse.length > 15) {
    try {
      const isNewsQuery = /\b(news|latest|recent|updates|today|yesterday|this week|released|announced|trending|happened|what's new|whats new)\b/i.test(cleanQ);

      // If asking for news or latest updates, search directly; otherwise search technical guides
      const searchParams = {
        q: isNewsQuery ? searchTerms : `${searchTerms} documentation guide tutorial`,
        engine: 'google',
        api_key: keyToUse,
        num: limit + 3,
      };

      if (isNewsQuery) {
        // Filter for fresh recent content
        searchParams.tbs = 'qdr:m';
      }

      const response = await axios.get('https://serpapi.com/search.json', {
        params: searchParams,
        timeout: 5500,
      });

      const newsResults = response.data?.news_results || [];
      const organicResults = response.data?.organic_results || [];
      const combined = [...newsResults, ...organicResults];

      if (combined.length > 0) {
        return combined.slice(0, limit).map((r) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet || r.summary || '',
          source: r.source?.name || r.displayed_link || 'Google Search',
          date: r.date || null,
          type: r.link?.includes('youtube.com') ? 'Video' : (isNewsQuery ? 'News Article' : 'Article'),
        }));
      }
    } catch (err) {
      console.warn('SerpApi live search error:', err.message);
    }
  }

  // Fallback to topic resources
  return fetchTopicResources(query);
}

/**
 * Search Google Images via SerpApi for architectural schematics, diagrams, and visual references
 */
export async function searchGoogleImages(query, limit = 2) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];

  const keyToUse = SERPAPI_KEY;
  if (!keyToUse || keyToUse.includes('your_') || keyToUse.length < 15) {
    return [];
  }

  try {
    const searchTerms = cleanQ.replace(/^(explain|what is|tell me about|how to|teach me)\s+/i, '').trim();
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_images',
        q: `${searchTerms} diagram`,
        api_key: keyToUse
      },
      timeout: 9000
    });

    const imageResults = response.data?.images_results || [];
    if (imageResults.length > 0) {
      return imageResults.slice(0, limit).map((img) => ({
        title: img.title || 'Educational Diagram',
        url: img.original || img.thumbnail,
        original: img.original || img.thumbnail,
        thumbnail: img.thumbnail,
        source: img.source || 'Google Images'
      }));
    }
  } catch (err) {
    console.warn('SerpApi Google Images search warning:', err.message);
  }
  return [];
}
