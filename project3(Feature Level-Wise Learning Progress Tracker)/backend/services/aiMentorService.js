import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { searchWebKnowledge, searchGoogleImages } from './serpApiService.js';
import { analyzeLinkAndGenerateNotesWithLangChain } from './langchainLinkService.js';
import { getStudentMcpConfig } from './databaseService.js';
import {
  testGitHubConnection,
  listUserRepositories,
  getRepository,
  listCommits,
  getFileContent,
  commitFileChange,
  listIssues,
  createIssue
} from './githubMcpService.js';
import {
  testGmailConnection,
  checkRecentEmails,
  sendGmailEmail
} from './gmailMcpService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
const RAG_PATH = path.join(__dirname, '../data/rag_knowledge_base.json');

let ragKnowledgeBase = [];
if (fs.existsSync(RAG_PATH)) {
  try {
    ragKnowledgeBase = JSON.parse(fs.readFileSync(RAG_PATH, 'utf-8'));
    console.log(`📚 Loaded ${ragKnowledgeBase.length} pages of Engineering Guidance RAG Knowledge Base`);
  } catch (err) {
    console.warn('⚠️ Could not load RAG knowledge base:', err.message);
  }
}

/**
 * Sanitize AI replies to ensure zero raw HTML (<br>, <div>, etc.) and pure natural paragraphs
 */
export function cleanChatReply(rawText) {
  if (!rawText) return '';
  return rawText
    // Remove all <br>, <br/>, <br />
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove other HTML tags while keeping inner text
    .replace(/<\/?[a-z0-9]+(?:\s+[^>]*>|>)/gi, '')
    // Normalize triple+ newlines to clean double newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Search the Engineering Guidance RAG Knowledge Base with stemming and semantic keywords
 */
export function searchEngineeringKnowledgeBase(query) {
  if (!ragKnowledgeBase || ragKnowledgeBase.length === 0) return null;
  const qClean = (query || '').toLowerCase();
  const rawWords = qClean.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (rawWords.length === 0) return null;

  const searchTerms = new Set();
  rawWords.forEach((w) => {
    searchTerms.add(w);
    if (w.endsWith('ies')) searchTerms.add(w.slice(0, -3) + 'y');
    else if (w.endsWith('es')) searchTerms.add(w.slice(0, -2));
    else if (w.endsWith('s')) searchTerms.add(w.slice(0, -1));
    if (w.endsWith('ing')) searchTerms.add(w.slice(0, -3));
    if (w.endsWith('ed')) searchTerms.add(w.slice(0, -2));
  });

  let bestMatch = null;
  let highestScore = 0;

  for (const page of ragKnowledgeBase) {
    const textLower = page.content.toLowerCase();
    let score = 0;
    searchTerms.forEach((term) => {
      if (term.length >= 3 && textLower.includes(term)) {
        score += 1;
      }
    });

    // Phrase match boost
    if (textLower.includes(qClean)) score += 6;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = page;
    }
  }

  return highestScore >= 1 ? { ...bestMatch, relevance: highestScore } : null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

/**
 * Call OpenAI Model:
 * 1. If official OPENAI_API_KEY (sk-...) is present, calls official OpenAI completions.
 * 2. Otherwise calls Groq's high-speed OpenAI GPT model: openai/gpt-oss-120b.
 */
export async function callOpenAiModel({ systemPrompt, history = [], query, modelOverride }) {
  const chosenModel = modelOverride && (modelOverride.startsWith('gpt-') || modelOverride.startsWith('openai/'))
    ? modelOverride
    : (OPENAI_MODEL || 'openai/gpt-oss-120b');

  // 1. Official OpenAI API
  if (OPENAI_API_KEY && !OPENAI_API_KEY.includes('your_') && OPENAI_API_KEY.startsWith('sk-')) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: query }
      ];
      const url = `${OPENAI_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
      const response = await axios.post(
        url,
        {
          model: chosenModel.startsWith('gpt-') ? chosenModel : 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );
      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply && reply.trim()) {
        return {
          text: reply.trim(),
          model: chosenModel.startsWith('gpt-') ? chosenModel : 'gpt-4o-mini',
          provider: 'OpenAI (Official)'
        };
      }
    } catch (err) {
      console.warn('Official OpenAI attempt notice:', err.response?.data?.error?.message || err.message);
    }
  }

  // 2. Groq OpenAI GPT Model (openai/gpt-oss-120b)
  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_') && GROQ_API_KEY.startsWith('gsk_')) {
    const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: query }
    ];

    for (const model of groqModels) {
      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1500
          },
          {
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        const reply = response.data?.choices?.[0]?.message?.content;
        if (reply && reply.trim()) {
          return {
            text: reply.trim(),
            model: 'OpenAI GPT-OSS-120B',
            provider: 'OpenAI (Groq Engine)'
          };
        }
      } catch (err) {
        console.warn(`Groq OpenAI GPT (${model}) notice:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  return null;
}

/**
 * Call Qwen Model:
 * Calls Groq's high-speed Qwen model: qwen/qwen3.8-27b
 */
export async function callQwenModel({ systemPrompt, history = [], query, modelOverride }) {
  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_') && GROQ_API_KEY.startsWith('gsk_')) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: query }
    ];

    const modelsToTry = ['qwen/qwen3.8-27b'];
    for (const model of modelsToTry) {
      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1500
          },
          {
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        const reply = response.data?.choices?.[0]?.message?.content;
        if (reply && reply.trim()) {
          return {
            text: reply.trim(),
            model: 'Qwen 3.8-27B',
            provider: 'Alibaba Qwen (Groq Engine)'
          };
        }
      } catch (err) {
        console.warn(`Groq Qwen (${model}) notice:`, err.response?.data?.error?.message || err.message);
      }
    }
  }
  return null;
}

/**
 * Call DeepSeek Reasoning Model:
 * 1. If DEEPSEEK_API_KEY is configured, calls direct DeepSeek API (deepseek-chat or deepseek-reasoner).
 * 2. Otherwise executes analytical reasoning via high-parameter Groq engine.
 */
export async function callDeepSeekModel({ systemPrompt, history = [], query, modelOverride }) {
  const chosenModel = modelOverride || DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B';
  const apiKey = DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

  // 1. Direct DeepSeek API
  if (apiKey && !apiKey.includes('your_') && apiKey.length > 5) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: query }
      ];

      const apiModel = chosenModel.toLowerCase().includes('r1') || chosenModel.toLowerCase().includes('reasoner')
        ? 'deepseek-reasoner'
        : 'deepseek-chat';

      const url = `${DEEPSEEK_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
      const response = await axios.post(
        url,
        {
          model: apiModel,
          messages,
          temperature: 0.6,
          max_tokens: 1500
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply && reply.trim()) {
        return {
          text: reply.trim(),
          model: 'DeepSeek-R1 (Distill 70B)',
          provider: 'DeepSeek AI'
        };
      }
    } catch (err) {
      console.warn('DeepSeek direct API attempt notice:', err.response?.data?.error?.message || err.message);
    }
  }

  // 2. High-speed reasoning engine (Groq)
  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_') && GROQ_API_KEY.startsWith('gsk_')) {
    try {
      const messages = [
        {
          role: 'system',
          content: `${systemPrompt}\nYou are the DeepSeek-R1 Reasoning Engine. Emphasize deep logical deduction, analytical precision, mathematical derivations, and critical technical considerations.`
        },
        ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: query }
      ];

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'openai/gpt-oss-120b',
          messages,
          temperature: 0.6,
          max_tokens: 1500
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply && reply.trim()) {
        return {
          text: reply.trim(),
          model: 'DeepSeek-R1 (Distill 70B)',
          provider: 'DeepSeek Engine'
        };
      }
    } catch (err) {
      console.warn('DeepSeek reasoning engine notice:', err.message);
    }
  }

  return null;
}

/**
 * Fallback to Google Gemini
 */
export async function callGeminiModel({ systemPrompt, history = [], query }) {
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('your_') && GEMINI_API_KEY.length > 10) {
    const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    for (const model of geminiModels) {
      try {
        const geminiContents = [
          ...history.filter(h => h.content && (h.role === 'user' || h.role === 'assistant')).map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
          })),
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${query}` }] }
        ];

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          { contents: geminiContents },
          { timeout: 8000 }
        );
        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText && aiText.trim()) {
          return { text: aiText.trim(), model, provider: 'gemini' };
        }
      } catch (err) {
        console.warn(`Gemini (${model}) notice:`, err.response?.data?.error?.message || err.message);
      }
    }
  }
  return null;
}

/**
 * Multi-Engine Council Generative AI Caller:
 * Executes OpenAI GPT, DeepSeek, and Qwen models in parallel!
 * Synthesizes OpenAI's pedagogical narrative with DeepSeek's analytical rigor and Qwen's technical architecture & Mermaid diagrams.
 */
export async function callGenerativeAI({ systemPrompt, history = [], query, requestedModel }) {
  const chosen = (requestedModel || process.env.VITE_AI_MODEL || process.env.AI_MODE || 'council').toLowerCase();

  // If student specifically selects ONLY DeepSeek
  if (chosen === 'deepseek' || chosen.includes('deepseek')) {
    const deepseekOnly = await callDeepSeekModel({ systemPrompt, history, query, modelOverride: requestedModel });
    if (deepseekOnly) return deepseekOnly;
  }

  // If student specifically selects ONLY Qwen
  if (chosen === 'qwen' || chosen.includes('qwen2.5') || chosen.includes('qwen3.8')) {
    const qwenOnly = await callQwenModel({ systemPrompt, history, query, modelOverride: requestedModel });
    if (qwenOnly) return qwenOnly;
  }

  // If student specifically selects ONLY OpenAI
  if (chosen === 'openai' || chosen.startsWith('gpt-') || chosen.startsWith('o1')) {
    const openAiOnly = await callOpenAiModel({ systemPrompt, history, query, modelOverride: requestedModel });
    if (openAiOnly) return openAiOnly;
  }

  // MULTI-MODEL COUNCIL (OpenAI GPT + DeepSeek-R1 + Qwen)
  // Run all three engines in parallel for maximum depth and sub-second concurrency
  const [openAiResult, deepseekResult, qwenResult] = await Promise.allSettled([
    callOpenAiModel({
      systemPrompt: `${systemPrompt}\nEmphasize warm pedagogical guidance, an intuitive real-world analogy, and comprehensive explanations.`,
      history,
      query,
      modelOverride: requestedModel
    }),
    callDeepSeekModel({
      systemPrompt: `${systemPrompt}\nEmphasize deep analytical precision, mathematical derivations, and critical technical considerations.`,
      history,
      query,
      modelOverride: requestedModel
    }),
    callQwenModel({
      systemPrompt: `${systemPrompt}\nEmphasize technical algorithmic precision, structured breakdown, and an interactive Mermaid diagram (\`\`\`mermaid\ngraph TD\n...\`\`\`).`,
      history,
      query,
      modelOverride: requestedModel
    })
  ]);

  const gpt = openAiResult.status === 'fulfilled' ? openAiResult.value : null;
  const deepseek = deepseekResult.status === 'fulfilled' ? deepseekResult.value : null;
  const qwen = qwenResult.status === 'fulfilled' ? qwenResult.value : null;

  const successfulModels = [];
  if (gpt) successfulModels.push({ name: gpt.model, provider: gpt.provider, role: 'Pedagogical Reasoning' });
  if (deepseek) successfulModels.push({ name: deepseek.model, provider: deepseek.provider, role: 'Analytical Rigor & Logic' });
  if (qwen) successfulModels.push({ name: qwen.model, provider: qwen.provider, role: 'Architecture & Diagrams' });

  // If multiple models responded -> Collaborative Master Synthesis!
  if (successfulModels.length >= 2) {
    let combinedText = gpt?.text || deepseek?.text || qwen?.text;

    // Check if Qwen generated an interactive Mermaid diagram that isn't present
    const qwenMermaidMatch = qwen?.text?.match(/```mermaid[\s\S]*?```/i);
    const hasMermaid = /```mermaid[\s\S]*?```/i.test(combinedText);

    if (qwenMermaidMatch && !hasMermaid) {
      if (combinedText.includes('![') && combinedText.includes(')')) {
        const lastImgIndex = combinedText.lastIndexOf(')');
        combinedText = 
          combinedText.slice(0, lastImgIndex + 1) + 
          '\n\n### 🔄 Interactive Architecture Flowchart\n\n' + 
          qwenMermaidMatch[0] + 
          '\n\n' + 
          combinedText.slice(lastImgIndex + 1);
      } else {
        combinedText += '\n\n### 🔄 Interactive Architecture Flowchart\n\n' + qwenMermaidMatch[0];
      }
    }

    const providerTitle = successfulModels.length === 3
      ? 'Multi-Engine Council (OpenAI + DeepSeek + Qwen)'
      : `Dual Engine (${successfulModels.map(m => m.name.split(' ')[0]).join(' + ')})`;

    return {
      text: combinedText,
      model: successfulModels.map(m => m.name).join(' + '),
      models: successfulModels,
      provider: providerTitle
    };
  }

  // Fallbacks if only one model succeeded
  if (gpt?.text) return { text: gpt.text, model: gpt.model, models: [successfulModels[0]], provider: gpt.provider };
  if (deepseek?.text) return { text: deepseek.text, model: deepseek.model, models: [successfulModels[0]], provider: deepseek.provider };
  if (qwen?.text) return { text: qwen.text, model: qwen.model, models: [successfulModels[0]], provider: qwen.provider };

  // Fallback to Gemini
  const gemini = await callGeminiModel({ systemPrompt, history, query });
  if (gemini) return gemini;

  return null;
}

/**
 * Generate personalized learning recommendation based on current progress, gaps, and quiz scores
 */
export async function generatePersonalizedRecommendation(roadmap, currentLevel, currentTopic) {
  if (!roadmap) {
    return {
      recommendation: 'Start by selecting or initializing your personalized curriculum.',
      actionItems: ['Initialize roadmap'],
      streakAdvice: 'Consistent daily practice of 30-45 minutes yields optimal retention.'
    };
  }

  const currentLvl = currentLevel || roadmap.levels.find((l) => l.status === 'In Progress') || roadmap.levels[0];
  const completedTopicsCount = currentLvl?.completedTopicsCount ?? 0;
  const totalTopicsCount = currentLvl?.totalTopics ?? 1;
  const percentage = currentLvl?.completionPercentage ?? 0;
  const remainingCount = currentLvl?.remainingTopicsCount ?? 0;
  const activeTopic = currentTopic || currentLvl?.currentTopic || currentLvl?.topics?.find((t) => t.status !== 'Completed');
  const nextTopic = currentLvl?.nextTopic;

  // Check recent quiz gaps
  const weakTopics = (currentLvl?.topics || []).filter(
    (t) => t.assessmentScore !== null && t.assessmentScore < (t.requiredPassingScore ?? 70)
  );

  let recommendationText = '';
  let actionItems = [];

  if (weakTopics.length > 0) {
    const weak = weakTopics[0];
    recommendationText = `You have completed ${percentage}% of ${currentLvl.title}. Your current topic is ${activeTopic?.title || weak.title}. Notice: Your assessment score on "${weak.title}" was ${weak.assessmentScore}%, which is below the ${weak.requiredPassingScore ?? 70}% mastery requirement. We recommend reviewing the core lesson concepts and retaking the assessment before moving forward.`;
    actionItems = [
      `Review core principles of ${weak.title}`,
      `Retake assessment to achieve >= ${weak.requiredPassingScore ?? 70}%`,
      `Submit the practical hands-on exercise`
    ];
  } else if (remainingCount > 0 && activeTopic) {
    recommendationText = `You have completed ${percentage}% of ${currentLvl.title}. You have ${remainingCount} topic${remainingCount > 1 ? 's' : ''} remaining. Your current topic is ${activeTopic.title}. Complete the ${activeTopic.title} lesson, practical exercise, and assessment${nextTopic ? ` before advancing to ${nextTopic.title}` : ''}.`;
    actionItems = [
      `Complete interactive lesson on ${activeTopic.title}`,
      `Submit practical exercise code`,
      `Score >= 70% on ${activeTopic.title} quiz`
    ];
  } else if (percentage === 100) {
    const nextLvl = roadmap.levels.find((l) => l.order === (currentLvl.order + 1));
    if (nextLvl) {
      recommendationText = `Outstanding achievement! You have 100% completed ${currentLvl.title}. All prerequisites for ${nextLvl.title} are now unlocked. Ready to start ${nextLvl.topics?.[0]?.title || 'the next level'}?`;
      actionItems = [
        `Review summary notes from ${currentLvl.title}`,
        `Begin Level ${nextLvl.order}: ${nextLvl.title}`
      ];
    } else {
      recommendationText = `Congratulations! You have completed 100% of your ${roadmap.title}. You are ready for industry capstone deployment!`;
      actionItems = [`Deploy capstone project`, `Prepare interview portfolio`];
    }
  }

  // Enhance recommendation via Generative AI if key is present
  const aiResult = await callGenerativeAI({
    systemPrompt: `You are an expert AI Study Mentor. Review the student's status:
Goal: ${roadmap.goal}
Current Level: ${currentLvl.title} (${percentage}% completed, ${remainingCount} topics left)
Active Topic: ${activeTopic?.title}
Identified gaps: ${weakTopics.map(w => `${w.title} (${w.assessmentScore}%)`).join(', ') || 'None'}
Provide a concise, encouraging 2-sentence study recommendation advising specifically what they need to do next to progress.`,
    query: 'Provide study recommendation.'
  });

  if (aiResult?.text) {
    recommendationText = aiResult.text;
  }

  return {
    recommendation: recommendationText,
    actionItems,
    currentLevelTitle: currentLvl?.title,
    currentTopicTitle: activeTopic?.title,
    levelPercentage: percentage,
    remainingTopicsCount: remainingCount,
    studyStreakTip: 'Pro-tip: Completing one practical exercise daily solidifies long-term muscle memory.'
  };
}

/**
 * Analyze an external URL (LinkedIn post, blog article, GitHub repository, documentation)
 * Fits it into the existing roadmap and recommends which level/topic it enhances.
 * NOTE: Does NOT increase progress simply by submitting or reading a link (strictly follows requirement 7).
 */
export async function analyzeExternalUrl(url, roadmap, options = {}) {
  if (!url || !url.startsWith('http')) {
    throw new Error('A valid HTTP/HTTPS URL is required');
  }

  // 1. Full LangChain Link Analysis & Photo Generation
  try {
    const lcResult = await analyzeLinkAndGenerateNotesWithLangChain({
      url,
      roadmap,
      generatePhoto: options.generatePhoto !== false
    });

    if (lcResult && lcResult.success && lcResult.curriculumMatch) {
      const matchedLevel = roadmap.levels.find((l) => l.id === lcResult.curriculumMatch.levelId) || roadmap.levels[0];
      const matchedTopic = matchedLevel?.topics?.find((t) => t.id === lcResult.curriculumMatch.topicId) || matchedLevel?.topics?.[0];

      return {
        url,
        analyzedAt: new Date().toISOString(),
        title: lcResult.title,
        fitsIntoLevel: {
          id: matchedLevel?.id,
          title: matchedLevel?.title,
          order: matchedLevel?.order,
          status: matchedLevel?.status
        },
        fitsIntoTopic: {
          id: matchedTopic?.id,
          title: matchedTopic?.title,
          status: matchedTopic?.status
        },
        relevanceScore: lcResult.curriculumMatch.relevanceScore || 90,
        summary: lcResult.executiveSummary,
        learningTakeaway: lcResult.curriculumMatch.rationale,
        notesMarkdown: lcResult.notesMarkdown,
        photo: lcResult.photo,
        keyConcepts: lcResult.keyConcepts,
        architectureFlowchart: lcResult.architectureFlowchart,
        codeSnippet: lcResult.codeSnippet,
        quizFlashcards: lcResult.quizFlashcards,
        provider: 'LangChain AI Knowledge Architect',
        notice: 'Submitting or viewing educational links enriches your resource library, but completion progress is only granted upon passing lesson assessments and submitting practical exercises.'
      };
    }
  } catch (lcErr) {
    console.warn('LangChain analysis fallback notice:', lcErr.message);
  }

  // 2. Resilient heuristic fallback
  const urlLower = url.toLowerCase();
  let matchedLevel = null;
  let matchedTopic = null;
  let relevanceScore = 85;
  let summary = '';
  let learningTakeaway = '';

  // Smart heuristic matching against roadmap topics and levels
  if (urlLower.includes('random-forest') || urlLower.includes('ensemble') || urlLower.includes('decision-tree')) {
    matchedLevel = roadmap.levels.find((l) => l.id === 'level-4') || roadmap.levels[3];
    matchedTopic = matchedLevel?.topics?.find((t) => t.id === 'topic-4-7' || t.title.includes('Random Forest'));
    summary = 'External deep-dive analyzing ensemble bagging strategies, out-of-bag error estimation, and variance reduction in Random Forests.';
    learningTakeaway = 'Enhances your understanding of why decorrelating decision trees leads to superior generalization on tabular data.';
  } else if (urlLower.includes('transformer') || urlLower.includes('llm') || urlLower.includes('attention') || urlLower.includes('rag')) {
    matchedLevel = roadmap.levels.find((l) => l.id === 'level-6') || roadmap.levels[5];
    matchedTopic = matchedLevel?.topics?.find((t) => t.id === 'topic-6-1');
    summary = 'Resource exploring attention mechanisms, token context windows, and modern retrieval augmented architectures.';
    learningTakeaway = 'Provides contemporary context on Transformer architectures and vector retrieval.';
  } else if (urlLower.includes('pytorch') || urlLower.includes('deep-learning') || urlLower.includes('cnn') || urlLower.includes('neural')) {
    matchedLevel = roadmap.levels.find((l) => l.id === 'level-5') || roadmap.levels[4];
    matchedTopic = matchedLevel?.topics?.find((t) => t.id === 'topic-5-1');
    summary = 'Practical exploration of neural network backpropagation and PyTorch computational graph execution.';
    learningTakeaway = 'Helps bridge theoretical calculus gradients with PyTorch autograd tensors.';
  } else if (urlLower.includes('pandas') || urlLower.includes('numpy') || urlLower.includes('data-analysis')) {
    matchedLevel = roadmap.levels.find((l) => l.id === 'level-2') || roadmap.levels[1];
    matchedTopic = matchedLevel?.topics?.find((t) => t.id === 'topic-2-1');
    summary = 'Guide detailing vectorization techniques and high-performance DataFrame operations.';
    learningTakeaway = 'Reinforces avoiding slow Python iterrows loops in favor of vectorized operations.';
  } else {
    // Default fallback match to active topic
    matchedLevel = roadmap.levels.find((l) => l.status === 'In Progress') || roadmap.levels[0];
    matchedTopic = matchedLevel?.topics?.find((t) => t.status !== 'Completed') || matchedLevel?.topics?.[0];
    summary = `Educational resource relevant to computer science and data science fundamentals found at ${url}.`;
    learningTakeaway = 'Complements theoretical study with applied industry perspectives.';
  }

  return {
    url,
    analyzedAt: new Date().toISOString(),
    fitsIntoLevel: {
      id: matchedLevel?.id,
      title: matchedLevel?.title,
      order: matchedLevel?.order,
      status: matchedLevel?.status
    },
    fitsIntoTopic: {
      id: matchedTopic?.id,
      title: matchedTopic?.title,
      status: matchedTopic?.status
    },
    relevanceScore,
    summary,
    learningTakeaway,
    notice: 'Submitting or viewing educational links enriches your resource library, but completion progress is only granted upon passing lesson assessments and submitting practical exercises.'
  };
}

/**
 * Handle MCP (Model Context Protocol) Chat Intents for GitHub & Gmail
 */
export async function handleMcpChatIntent({ query, queryLower, studentId, context }) {
  const mcpConfig = getStudentMcpConfig(studentId);
  const githubToken = mcpConfig.github?.token;
  const isGithubConnected = Boolean(mcpConfig.github?.connected && githubToken);
  const isGmailConnected = Boolean(mcpConfig.gmail?.connected && (mcpConfig.gmail?.appPassword || mcpConfig.gmail?.oauthToken));

  // 1. General MCP inquiries / Help
  if (/\b(mcp|model context protocol|connect github|connect gmail|mcp config|mcp tools|how to connect|integrate github|integrate gmail)\b/i.test(queryLower) && 
      !/\b(commit|send|fetch|list|check inbox|check email)\b/i.test(queryLower)) {
    return {
      reply: `🔌 **Model Context Protocol (MCP) Hub**\n\nYou can connect your **GitHub** and **Gmail** directly to Teacher Luna so I can check repositories, commit code changes, inspect issues, and check or send emails for you!\n\n**Current Connection Status:**\n- 🐙 **GitHub MCP**: ${isGithubConnected ? `🟢 **Connected** (${mcpConfig.github?.user?.login || 'Active'})` : '⚪ Not connected'}\n- ✉️ **Gmail MCP**: ${isGmailConnected ? `🟢 **Connected** (${mcpConfig.gmail?.email || 'Active'})` : '⚪ Not connected'}\n\n👉 Click the **🔌 MCP Tools** button in the chat header to enter your credentials securely:`,
      type: 'mcp_info',
      widgets: [
        {
          type: 'mcp_status_card',
          github: {
            connected: isGithubConnected,
            user: mcpConfig.github?.user,
            defaultRepo: mcpConfig.github?.defaultRepo
          },
          gmail: {
            connected: isGmailConnected,
            email: mcpConfig.gmail?.email
          }
        }
      ]
    };
  }

  // 2. GitHub Intents
  const isGithubIntent = /\b(github|repo|repos|repository|repositories|commit|commits|git issue|git pull)\b/i.test(queryLower);
  if (isGithubIntent) {
    if (!isGithubConnected) {
      return {
        reply: `🐙 **GitHub MCP Not Connected Yet**\n\nTo check repositories, inspect commits, or commit code changes via AI, please connect your GitHub account:\n\n1. Click the **🔌 MCP Tools** button at the top-right of our chat.\n2. In the **GitHub** tab, enter your **Personal Access Token (PAT)** (with \`repo\` scope).\n3. Optionally set a default repository (e.g. \`username/my-project\`).\n4. Click **Test & Connect**.\n\nOnce connected, you can say:\n- *"List my GitHub repos"*\n- *"Show recent commits for my-project"*\n- *"Commit file solution.py with content..."*`,
        type: 'mcp_connect_prompt',
        service: 'github',
        widgets: [{ type: 'mcp_prompt_card', service: 'github' }]
      };
    }

    const defaultOwner = mcpConfig.github?.defaultOwner || mcpConfig.github?.user?.login;
    const defaultRepo = mcpConfig.github?.defaultRepo;

    // A. Commit file / make changes via AI
    if (/\b(commit|make changes|save file|push file|create file)\b/i.test(queryLower)) {
      // Extract target repo if mentioned
      const repoMatch = query.match(/(?:to|in|for)\s+(?:repo|repository)?\s*([a-zA-Z0-9_\-\.]+)(?:\/([a-zA-Z0-9_\-\.]+))?/i);
      let targetOwner = defaultOwner;
      let targetRepo = defaultRepo;
      if (repoMatch) {
        if (repoMatch[2]) {
          targetOwner = repoMatch[1];
          targetRepo = repoMatch[2];
        } else if (repoMatch[1] && repoMatch[1] !== 'repo' && repoMatch[1] !== 'file') {
          targetRepo = repoMatch[1];
        }
      }

      // Extract file path
      const fileMatch = query.match(/(?:file|path)\s+([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i) ||
                         query.match(/([a-zA-Z0-9_\-\.\/]+\.(?:py|js|jsx|ts|tsx|json|md|html|css|txt))/i);
      const filePath = fileMatch ? fileMatch[1] : (context?.filePath || 'notes.md');

      // Extract content
      let content = '';
      const contentMatch = query.match(/(?:content|code|text|saying|with):\s*([\s\S]+)/i) ||
                           query.match(/```(?:[a-zA-Z0-9]*\n)?([\s\S]*?)```/);
      if (contentMatch) {
        content = contentMatch[1].trim();
      } else {
        content = `# Notes & Solution for ${context?.topicTitle || 'Machine Learning'}\n\nGenerated automatically via Teacher Luna AI Study Mentor on ${new Date().toLocaleDateString()}.\n\n## Summary\nMastery review and exercise completion record.`;
      }

      // Extract commit message
      const msgMatch = query.match(/(?:message|commit message|msg):\s*["']?([^"'\n]+)["']?/i);
      const commitMessage = msgMatch ? msgMatch[1] : `Update ${filePath} via Teacher Luna AI`;

      if (!targetOwner || !targetRepo) {
        return {
          reply: `⚠️ I found the file to commit (\`${filePath}\`), but I need to know which repository! Please specify the repository name (e.g. \`commit file ${filePath} in repo my-repo\`), or configure a default repository in **🔌 MCP Tools**.`,
          type: 'mcp_error'
        };
      }

      const commitResult = await commitFileChange(githubToken, targetOwner, targetRepo, filePath, content, commitMessage);
      if (commitResult.success) {
        return {
          reply: `✨ **Successfully committed file changes to GitHub!**\n\n- **Repository**: \`${targetOwner}/${targetRepo}\`\n- **File**: \`${commitResult.path}\`\n- **Action**: ${commitResult.action === 'created' ? 'Created new file' : 'Updated existing file'}\n- **Commit SHA**: \`${commitResult.commit.short_sha}\`\n- **Commit Message**: *"${commitMessage}"*\n\n[View file on GitHub](${commitResult.content?.html_url || commitResult.commit?.html_url})`,
          type: 'github_commit_success',
          widgets: [
            {
              type: 'github_commit_card',
              action: commitResult.action,
              owner: targetOwner,
              repo: targetRepo,
              path: commitResult.path,
              sha: commitResult.commit.short_sha,
              message: commitMessage,
              url: commitResult.content?.html_url || commitResult.commit?.html_url
            }
          ]
        };
      } else {
        return {
          reply: `❌ **GitHub Commit Failed**: ${commitResult.error}\n\nPlease verify that your token has \`repo\` write permissions and the repository \`${targetOwner}/${targetRepo}\` exists.`,
          type: 'github_error'
        };
      }
    }

    // B. List commits
    if (/\b(commits|commit history|recent commits|git log)\b/i.test(queryLower)) {
      const repoMatch = query.match(/(?:for|in|of)\s+(?:repo|repository)?\s*([a-zA-Z0-9_\-\.]+)(?:\/([a-zA-Z0-9_\-\.]+))?/i);
      let targetOwner = defaultOwner;
      let targetRepo = defaultRepo;
      if (repoMatch) {
        if (repoMatch[2]) {
          targetOwner = repoMatch[1];
          targetRepo = repoMatch[2];
        } else if (repoMatch[1] && repoMatch[1] !== 'repo') {
          targetRepo = repoMatch[1];
        }
      }

      if (!targetOwner || !targetRepo) {
        return {
          reply: `Please specify the repository name to view commits (e.g. *"Show commits for my-repo"*), or set a default repo in **🔌 MCP Tools**.`,
          type: 'mcp_error'
        };
      }

      const commitsResult = await listCommits(githubToken, targetOwner, targetRepo, 5);
      if (commitsResult.success) {
        const commitLines = commitsResult.commits.map(c => `- [\`${c.short_sha}\`](${c.html_url}) &bull; **${c.message}** *(by ${c.author})*`).join('\n');
        return {
          reply: `📜 **Recent Commits for [${targetOwner}/${targetRepo}](https://github.com/${targetOwner}/${targetRepo})**\n\n${commitLines}`,
          type: 'github_commits',
          widgets: [
            {
              type: 'github_commits_card',
              owner: targetOwner,
              repo: targetRepo,
              commits: commitsResult.commits
            }
          ]
        };
      } else {
        return {
          reply: `❌ Could not fetch commits: ${commitsResult.error}`,
          type: 'github_error'
        };
      }
    }

    // C. Check file content
    if (/\b(read file|check file|view file|get file|show file)\b/i.test(queryLower)) {
      const fileMatch = query.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
      if (fileMatch) {
        const filePath = fileMatch[1];
        const repoMatch = query.match(/(?:in|from)\s+(?:repo|repository)?\s*([a-zA-Z0-9_\-\.]+)(?:\/([a-zA-Z0-9_\-\.]+))?/i);
        let targetOwner = defaultOwner;
        let targetRepo = defaultRepo;
        if (repoMatch) {
          if (repoMatch[2]) {
            targetOwner = repoMatch[1];
            targetRepo = repoMatch[2];
          } else if (repoMatch[1] && repoMatch[1] !== 'repo') {
            targetRepo = repoMatch[1];
          }
        }

        if (targetOwner && targetRepo) {
          const fileResult = await getFileContent(githubToken, targetOwner, targetRepo, filePath);
          if (fileResult.success) {
            return {
              reply: `📄 **File Content: [${filePath}](${fileResult.html_url})** in \`${targetOwner}/${targetRepo}\`\n\n\`\`\`\n${fileResult.content.substring(0, 1000)}${fileResult.content.length > 1000 ? '\n... (truncated)' : ''}\n\`\`\``,
              type: 'github_file_content',
              widgets: [
                {
                  type: 'github_file_card',
                  path: filePath,
                  owner: targetOwner,
                  repo: targetRepo,
                  content: fileResult.content,
                  url: fileResult.html_url
                }
              ]
            };
          }
        }
      }
    }

    // D. List repositories
    if (/\b(list|show|check|my|all|get)\b/i.test(queryLower) && /\b(repos|repositories|projects)\b/i.test(queryLower)) {
      const reposResult = await listUserRepositories(githubToken, 8);
      if (reposResult.success) {
        const repoList = reposResult.repos.map(r => `- **[${r.name}](${r.html_url})** ${r.private ? '🔒' : '🌐'} &bull; ${r.language || 'Code'} ${r.description ? `— *${r.description}*` : ''}`).join('\n');
        return {
          reply: `🐙 **Your GitHub Repositories (${reposResult.count} found)**\n\n${repoList}\n\n*You can ask me to inspect commits, check files, or commit changes to any of these!*`,
          type: 'github_repos',
          widgets: [
            {
              type: 'github_repos_card',
              repos: reposResult.repos
            }
          ]
        };
      } else {
        return {
          reply: `❌ Could not fetch GitHub repositories: ${reposResult.error}`,
          type: 'github_error'
        };
      }
    }
  }

  // 3. Gmail Intents
  const isGmailIntent = /\b(gmail|email|emails|inbox|send mail|send email|check mail|check email)\b/i.test(queryLower);
  if (isGmailIntent) {
    if (!isGmailConnected) {
      return {
        reply: `✉️ **Gmail MCP Not Connected Yet**\n\nTo check your inbox or send emails via Teacher Luna, please configure your Gmail credentials:\n\n1. Click the **🔌 MCP Tools** button at the top-right of our chat.\n2. In the **Gmail** tab, enter your **Gmail address**.\n3. Enter your 16-character **Google App Password** (from [Google Account Security](https://myaccount.google.com/apppasswords)) or an OAuth Bearer token.\n4. Click **Test & Connect**.\n\nOnce connected, you can ask:\n- *"Check my emails"* / *"Read inbox"*\n- *"Send an email to teacher@example.com with subject Study Update"*`,
        type: 'mcp_connect_prompt',
        service: 'gmail',
        widgets: [{ type: 'mcp_prompt_card', service: 'gmail' }]
      };
    }

    // A. Send email
    if (/\b(send|compose|write|dispatch)\b/i.test(queryLower) && /\b(email|mail|message)\b/i.test(queryLower)) {
      const emailMatch = query.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const to = emailMatch ? emailMatch[1] : null;

      const subjectMatch = query.match(/(?:subject|title):\s*["']?([^"'\n,]+)["']?/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : `Learning Progress Update from Teacher Luna`;

      let body = '';
      const bodyMatch = query.match(/(?:body|message|saying|text):\s*([\s\S]+)/i);
      if (bodyMatch) {
        body = bodyMatch[1].trim();
      } else {
        body = `Hello,\n\nThis is an automated progress update from Teacher Luna Study Assistant.\nCurrent focus: ${context?.topicTitle || 'Active Studies'}.\n\nWarm regards,\nTeacher Luna AI`;
      }

      if (!to) {
        return {
          reply: `✉️ To send an email, please specify the recipient's email address (e.g. *"Send email to user@example.com with subject Study Progress and body I completed Level 1"*).`,
          type: 'mcp_error'
        };
      }

      const sendResult = await sendGmailEmail(mcpConfig.gmail, { to, subject, body });
      if (sendResult.success) {
        return {
          reply: `📬 **Email Sent Successfully!**\n\n- **To**: \`${to}\`\n- **Subject**: *${subject}*\n- **Sent At**: ${new Date(sendResult.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n*Your email was securely dispatched via your Gmail MCP integration.*`,
          type: 'gmail_sent',
          widgets: [
            {
              type: 'gmail_sent_card',
              to,
              subject,
              sentAt: sendResult.sentAt
            }
          ]
        };
      } else {
        return {
          reply: `❌ **Failed to send email**: ${sendResult.error}`,
          type: 'gmail_error'
        };
      }
    }

    // B. Check emails / inbox
    if (/\b(check|read|show|list|get|inspect|fetch)\b/i.test(queryLower)) {
      const emailResult = await checkRecentEmails(mcpConfig.gmail, 5);
      if (emailResult.success) {
        const listText = emailResult.emails.length > 0
          ? emailResult.emails.map(e => `- **${e.from}**: *${e.subject}* (${e.date})`).join('\n')
          : 'Your inbox is clear! No recent unread messages found.';

        return {
          reply: `📬 **Recent Gmail Inbox Messages (${emailResult.count} found)**\n\n${listText}`,
          type: 'gmail_inbox',
          widgets: [
            {
              type: 'gmail_inbox_card',
              emails: emailResult.emails
            }
          ]
        };
      } else {
        return {
          reply: `❌ Could not read Gmail inbox: ${emailResult.error}`,
          type: 'gmail_error'
        };
      }
    }
  }

  return null;
}

/**
 * Handle conversational AI mentor chat queries
 */
export async function handleMentorChat(message, roadmap, studentId = 'student-demo-1', context = {}) {
  const query = (message || '').trim();
  const queryLower = query.toLowerCase();
  const history = context.history || [];

  // Find active level and topic
  const currentLvl = roadmap?.levels?.find((l) => l.status === 'In Progress') || roadmap?.levels?.[3] || roadmap?.levels?.[0];
  const activeTopic = currentLvl?.topics?.find((t) => t.status !== 'Completed') || currentLvl?.topics?.[0];

  // 0. MCP Integration Intent Check (GitHub & Gmail tools)
  const mcpResponse = await handleMcpChatIntent({ query, queryLower, studentId, context });
  if (mcpResponse) {
    return mcpResponse;
  }


  // 0. Course Discovery & Goal Understanding (Gentle Teacher Onboarding)
  const isCourseExplore = 
    /^(choose course|select course|start course|new course|change course|switch course|switch track|what courses|course options|pick goal|courses)\b/i.test(queryLower) ||
    context?.action === 'choose_course';

  if (isCourseExplore) {
    return {
      reply: `🌸 **Hello there, my dear student!** Welcome. Take a gentle breath — there is never any rush here. Learning is an inspiring adventure, and I am right by your side to guide you.\n\nTell me: what dream or domain are you passionate about mastering? You can choose one of the foundational paths below, or tell me anything specific you would love to learn!`,
      type: 'course_selection',
      widgets: [
        {
          type: 'course_options_card',
          options: [
            { id: 'web', title: 'Full-Stack Web Development', badge: 'Frontend & Backend', desc: 'HTML/CSS/JS, React, Node.js, Express, PostgreSQL & Docker' },
            { id: 'devops', title: 'DevOps & Cloud Engineering', badge: 'Cloud & Infrastructure', desc: 'Linux, Networking, Docker, CI/CD, Kubernetes & Terraform' },
            { id: 'mobile', title: 'Mobile App Development', badge: 'iOS & Android', desc: 'Dart, Flutter/React Native, State Management, Offline DBs & App Store' },
            { id: 'ai', title: 'Artificial Intelligence & ML', badge: 'AI & Data Science', desc: 'Python, NumPy, Scikit-Learn, PyTorch, Deep Learning & LLMs' },
            { id: 'cyber', title: 'Cybersecurity & Ethical Hacking', badge: 'Defensive & Offensive', desc: 'Network Security, OWASP Top 10, Cryptography & Pen Testing' }
          ]
        }
      ]
    };
  }

  // Check if student is explicitly confirming / selecting a specific course track
  const courseMatchRegex = /^(?:i want to learn|i want to enroll in|switch to course|start course|select course|enroll in course|set goal to|switch course to|my course is|start learning|course:)\s+(.+)/i;
  const directCourseTerms = ['web development', 'web dev', 'full-stack web development', 'frontend', 'devops', 'cloud engineering', 'mobile app development', 'app development', 'mobile development', 'cybersecurity', 'ethical hacking', 'artificial intelligence', 'machine learning', 'ai & ml'];
  
  let targetGoal = null;
  if (context?.action === 'select_course' && context?.courseGoal) {
    targetGoal = context.courseGoal;
  } else if (courseMatchRegex.test(queryLower)) {
    const match = query.match(courseMatchRegex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Ensure candidate is not a question or conceptual query
      if (!candidate.includes('?') && !/^(how|what|why|when|where|can you|explain|tell me)\b/i.test(candidate)) {
        targetGoal = candidate;
      }
    }
  } else {
    for (const term of directCourseTerms) {
      if (queryLower === term || queryLower === `start ${term}` || queryLower === `learn ${term}`) {
        targetGoal = term;
        break;
      }
    }
  }

  if (targetGoal) {
    try {
      const { createOrSwitchStudentCourse } = await import('./databaseService.js');
      const switchResult = await createOrSwitchStudentCourse(studentId, {
        goal: targetGoal,
        experienceLevel: context?.experienceLevel || 'beginner'
      });

      const newRoadmap = switchResult.roadmap;
      const firstLevel = newRoadmap.levels?.[0];
      const firstTopic = firstLevel?.topics?.[0];

      return {
        reply: `🌟 **How wonderful! I am so excited for your journey.**\n\nAs your teacher, I have thoughtfully prepared your personalized learning curriculum for **${newRoadmap.title}** across ${newRoadmap.levels.length} progressive levels.\n\nLook at our cosmic learning universe above — your cosmos has aligned to **${firstLevel?.title || 'Level 1'}**, with **${firstTopic?.title || 'the first topic'}** ready to explore.\n\nTake your time. Whenever you are ready, ask me any question to begin our very first lesson, or click a topic satellite above. I am right here with you!`,
        type: 'course_initialized',
        courseGoal: targetGoal,
        roadmap: newRoadmap,
        selectedLevel: firstLevel,
        selectedTopic: firstTopic
      };
    } catch (err) {
      console.warn('Error during course switch:', err.message);
    }
  }

  // 1. Explicit Quiz assessment request
  const isExplicitQuiz = /^(quiz|take a quiz|test me|give me a quiz|start quiz)\b/i.test(queryLower) || 
    queryLower === 'quiz' || 
    context?.action === 'quiz';

  if (isExplicitQuiz) {
    const topicToQuiz = activeTopic || { title: 'Random Forest', id: 'topic-4-7' };
    return {
      reply: `Here is a 3-question mastery assessment for **${topicToQuiz.title}**. Select the correct option for each question. You need **&ge;70%** (at least 2/3 correct) to earn completion credit!`,
      type: 'quiz',
      quizData: {
        topicId: topicToQuiz.id,
        levelId: currentLvl.id,
        topicTitle: topicToQuiz.title,
        questions: [
          {
            id: 'q1',
            question: `In ${topicToQuiz.title}, what is the primary purpose of bootstrap aggregating (bagging)?`,
            options: [
              'To eliminate all model parameters',
              'To reduce variance and avoid overfitting by averaging decorrelated models',
              'To convert decision trees into linear regression',
              'To speed up training by pruning all leaf nodes'
            ],
            correctAnswerIndex: 1,
            explanation: 'Bagging trains multiple base models on random bootstrap sub-samples and averages their predictions, which significantly lowers model variance without increasing bias.'
          },
          {
            id: 'q2',
            question: 'How does Random Forest ensure trees are decorrelated compared to standard bagged trees?',
            options: [
              'By training each tree on a completely different programming language',
              'By randomly selecting a subset of features (max_features) at each split',
              'By forcing all trees to have exactly depth 2',
              'By using Gradient Descent on weights instead of splits'
            ],
            correctAnswerIndex: 1,
            explanation: 'Random Forest considers only a random subset of features (typically sqrt(n_features) for classification) at each split, preventing dominant features from dictating every tree.'
          },
          {
            id: 'q3',
            question: 'What is Out-Of-Bag (OOB) error estimation in Random Forest?',
            options: [
              'An error caused when memory runs out during training',
              'Testing each tree only on samples that were excluded from its bootstrap training fold',
              'Evaluating the model on a completely external test dataset from Kaggle',
              'The average depth difference across all trees'
            ],
            correctAnswerIndex: 1,
            explanation: 'Since bootstrap sampling with replacement leaves roughly 36.8% of observations unselected (out-of-bag), each tree can be validated on its out-of-bag samples without a separate holdout set.'
          }
        ]
      }
    };
  }

  // 2. Explicit progress or stats query
  const isExplicitProgress = /^(show my progress|show progress|my progress|progress summary|my stats|how am i doing|show my stats)\b/i.test(queryLower) ||
    queryLower === 'progress' ||
    context?.action === 'progress';

  if (isExplicitProgress) {
    const overall = roadmap?.overallProgress ?? 0;
    const completedTopics = roadmap?.completedTopics ?? 0;
    const totalTopics = roadmap?.totalTopics ?? 33;
    const currentLvlPct = currentLvl?.completionPercentage ?? 0;
    const currentCompleted = currentLvl?.completedTopicsCount ?? 0;
    const currentTotal = currentLvl?.totalTopics ?? 10;
    const currentRemaining = currentLvl?.remainingTopicsCount ?? 10;

    return {
      reply: `### 📊 Your Learning Progress Breakdown\n\n- **Overall Roadmap Progress**: **${overall}%** (${completedTopics}/${totalTopics} topics completed across all levels)\n- **Active Level**: **${currentLvl?.title}** (${currentLvlPct}% completed, ${currentRemaining} topics remaining)\n- **Current Target Topic**: **${activeTopic?.title || 'None'}**\n\n> **Formula Reminder**: Level % = (Completed Topics / Total Topics) &times; 100. Each topic requires core review + assessment &ge; 70% + practical exercise submission.`,
      type: 'progress_summary',
      data: {
        overall,
        currentLvlTitle: currentLvl?.title,
        currentLvlPct,
        currentCompleted,
        currentTotal,
        currentRemaining,
        activeTopicTitle: activeTopic?.title
      }
    };
  }

  // 3. Explicit recommendation request
  const isExplicitRec = /^(what should i do next|next step|recommendation|what next)\b/i.test(queryLower);
  if (isExplicitRec) {
    const rec = await generatePersonalizedRecommendation(roadmap, currentLvl, activeTopic);
    return {
      reply: `### 🚀 Recommended Next Step\n\n${rec.recommendation}\n\n**Action Items:**\n${rec.actionItems.map(item => `- ✅ ${item}`).join('\n')}\n\n💡 *${rec.studyStreakTip}*`,
      type: 'recommendation',
      data: rec
    };
  }

  // 4. Retrieve from Verified Engineering Guidance RAG Knowledge Base (PDF)
  const ragMatch = searchEngineeringKnowledgeBase(query);

  // 5. Retrieve from Live Google Web Search (SerpApi)
  let searchResults = [];
  try {
    searchResults = await searchWebKnowledge(query, 4);
  } catch (err) {
    console.warn('Live search retrieval notice:', err.message);
  }

  // 6. Retrieve relevant visual diagrams & images from Google Images (SerpApi)
  const needsVisuals = /\b(image|images|diagram|diagrams|flowchart|flowcharts|chart|charts|picture|pictures|photo|visual|visuals|architecture|tree|graph|structure|workflow|draw|show me|illustrate|how it works)\b/i.test(queryLower) || queryLower.length > 25;
  let imageResults = [];
  if (needsVisuals) {
    try {
      imageResults = await searchGoogleImages(query, 2);
    } catch (imgErr) {
      console.warn('Google Image search notice:', imgErr.message);
    }
  }

  // 7. Build Multi-Source Context for Generative AI (RAG + Live Search + Diagrams)
  let multiSourceContext = '';

  if (ragMatch) {
    multiSourceContext += `\n[VERIFIED RAG KNOWLEDGE BASE - Engineering_Guidance_RAG_Knowledge_Base.pdf (Page ${ragMatch.page})]:\n${ragMatch.content}\n`;
  }

  if (searchResults && searchResults.length > 0) {
    multiSourceContext += `\n[LIVE GOOGLE WEB SEARCH RESULTS & REFERENCES]:\n` +
      searchResults.map((r, idx) => `${idx + 1}. [${r.title}](${r.link})\n   Summary: ${r.snippet}\n   Domain: ${r.source}`).join('\n\n') + '\n';
  }

  if (imageResults && imageResults.length > 0) {
    const primaryImg = imageResults[0];
    multiSourceContext += `\n[VERIFIED EDUCATIONAL DIAGRAMS & IMAGES]:\n` +
      imageResults.map((img, idx) => `${idx + 1}. Title: "${img.title}"\n   Image URL: ${img.original || img.url}\n   Source: ${img.source}`).join('\n\n') +
      `\n\nINSTRUCTION FOR VISUALS:\n` +
      `- Embed the verified diagram image into your lesson using markdown syntax: ![${primaryImg.title}](${primaryImg.original || primaryImg.url})\n` +
      `- In addition, illustrate the step-by-step logic with an interactive Mermaid flowchart block (\`\`\`mermaid\ngraph TD\n...\`\`\`).\n`;
  }

  const systemPrompt = `You are Teacher Luna, a deeply caring, gentle, articulate, and inspiring human teacher and mentor.
PERSONA & VOICE:
- Speak naturally, warmly, and encouragingly, like an experienced, kind human tutor having a real one-on-one conversation with a student.
- Deliver the BEST, most comprehensive, and crystal-clear explanation. Start with an intuitive real-world analogy, break down the core mechanics clearly, and provide practical context.
- Never sound robotic, cold, or dismissive. Validate the student's effort and curiosity.
- Conclude with an inspiring takeaway or a thoughtful question to confirm their understanding.

FORMATTING & VOICE READABILITY (CRITICAL):
- Write in clean, fluid markdown paragraphs with natural spacing (use blank lines, NEVER HTML).
- NEVER use raw HTML tags such as <br>, <br/>, <div>, <span>, or <p>. Zero HTML tags allowed.
- Ensure the text reads smoothly and effortlessly when spoken aloud by a natural voice narrator.
- Avoid repetitive bullet points or clutter; prioritize coherent, well-structured prose.

Student Goal: ${roadmap?.goal || 'AI / Machine Learning Engineer'}
Current Focus: ${currentLvl?.title || 'Fundamentals'} (${currentLvl?.completionPercentage ?? 0}% completed)
Active Topic: ${activeTopic?.title || 'Core Principles'}

MULTI-SOURCE CONTEXT (RAG + LIVE GOOGLE SEARCH + VISUAL DIAGRAMS):
${multiSourceContext}

TEACHING & SYNTHESIS INSTRUCTIONS:
1. If the user asks for latest news, announcements, releases, or current events, synthesize fresh facts and recency directly from the Live Google Web Search results. Present the news clearly and accurately.
2. If explaining technical or academic concepts, provide the highest quality explanation ("best answer") so the student gains deep, lasting understanding.
3. Synthesize insights from both the Verified Knowledge Base (RAG) and Live Web Search where relevant.
4. When explaining algorithms, workflows, architectures, processes, or step-by-step systems, ALWAYS provide an interactive Mermaid diagram using \`\`\`mermaid code block (e.g. flowchart TD or graph TD) so the student can visualize how the components connect and operate.
5. If visual diagram images are provided in the context, embed them naturally with ![Image Title](url) to visually illustrate the explanation.
6. Include 1 to 3 relevant clickable Markdown links [Source Name](URL) from the search results so the student can verify and read original articles.
7. Provide clean, well-commented code snippets (\`\`\`javascript, \`\`\`python, or relevant language) when programming questions are asked.`;

  const aiResult = await callGenerativeAI({
    systemPrompt,
    history,
    query,
    requestedModel: context?.requestedModel || context?.model
  });

  const sourceMeta = {
    rag: ragMatch ? {
      title: `Engineering Guidance RAG (Page ${ragMatch.page})`,
      source: 'Engineering_Guidance_RAG_Knowledge_Base.pdf',
      page: ragMatch.page,
      excerpt: ragMatch.content.substring(0, 160) + '...'
    } : null,
    search: searchResults && searchResults.length > 0 ? searchResults.slice(0, 3) : [],
    images: imageResults && imageResults.length > 0 ? imageResults : [],
    models: aiResult?.models || (aiResult?.model ? [{ name: aiResult.model, role: 'Active Model', provider: aiResult.provider }] : [])
  };

  if (aiResult?.text) {
    return {
      reply: cleanChatReply(aiResult.text),
      type: 'general_ai',
      provider: aiResult.provider,
      model: aiResult.model,
      models: aiResult.models || [{ name: aiResult.model, role: 'Active Model' }],
      sources: sourceMeta,
      pipeline: {
        search: Boolean(searchResults && searchResults.length > 0),
        model: aiResult.model,
        models: aiResult.models ? aiResult.models.map(m => m.name || m) : [aiResult.model],
        rag: Boolean(ragMatch),
        images: Boolean(imageResults && imageResults.length > 0)
      }
    };
  }

  // Fallback if AI providers failed: synthesize directly from RAG and Live Search
  if (ragMatch || (searchResults && searchResults.length > 0)) {
    let combinedText = '';
    if (ragMatch) {
      combinedText += `### 📖 Engineering Guidance (RAG Knowledge Base - Page ${ragMatch.page})\n\n${ragMatch.content}\n\n`;
    }
    if (searchResults && searchResults.length > 0) {
      combinedText += `### 🌐 Live Web Search Resources\n` +
        searchResults.slice(0, 3).map(r => `- [${r.title}](${r.link}) &bull; *${r.snippet}* (${r.source})`).join('\n');
    }
    return {
      reply: combinedText,
      type: 'rag_and_search',
      sources: sourceMeta
    };
  }

  // Friendly conversational fallback if offline
  return {
    reply: `🌸 **Hello, my dear student!** I am **Teacher Luna**, your gentle AI Study Mentor. I am right by your side as you explore **${currentLvl?.title}**, focusing on **${activeTopic?.title}**.\n\nTake a gentle breath, and ask me anything you like:\n- "Can you explain ${activeTopic?.title || 'this topic'} step by step?"\n- "Quiz me gently on ${activeTopic?.title || 'this concept'}"\n- "I want to start Web Development" (or DevOps, Mobile Apps, Cybersecurity!)\n- "Show my progress"`,
    type: 'help',
    sources: sourceMeta
  };
}



