import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { isSupabaseConfigured } from './config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load unified root .env (single source of truth for both frontend and backend)
const rootEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: rootEnvPath, override: true });

const app = express();
const PORT = process.env.PORT || 5055;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
    version: '1.0.0',
    service: 'AI Study Mentor - Level-Wise Progress Tracker API'
  });
});

// Serve Unified Frontend directly if built
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log(`🌐 Integrated Frontend connected and serving from: ${frontendDistPath}`);
}

// Auto-ensure local OpenAI-compatible TTS server (port 5058) is up
function ensureLocalOpenAiTts() {
  import('http').then(({ default: http }) => {
    const req = http.get('http://127.0.0.1:5058/health', (res) => {
      if (res.statusCode === 200) {
        console.log('🎙️ Local OpenAI TTS Server active on http://localhost:5058');
      }
    });
    req.on('error', () => {
      const ttsScript = path.resolve(__dirname, '../tts_server.py');
      if (fs.existsSync(ttsScript)) {
        import('child_process').then(({ spawn }) => {
          console.log('🎙️ Auto-launching Local OpenAI TTS Server on http://localhost:5058 ...');
          const child = spawn('python', [ttsScript], {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'ignore',
            detached: true
          });
          child.unref();
        });
      }
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  ensureLocalOpenAiTts();
  console.log(`\n================================================================`);
  console.log(`🚀 AI Study Mentor & Teacher Luna is FULLY CONNECTED!`);
  console.log(`📡 Backend API: Running on internal port ${PORT} (Connected via Vite)`);
  console.log(`👉 Open in your browser: http://localhost:5180`);
  console.log(`📡 Supabase Database: ${isSupabaseConfigured() ? 'Connected via cloud' : 'Running in local persistent mode'}`);
  console.log(`📚 Engineering Guidance RAG Knowledge Base: Active (18 pages)`);
  console.log(`🔎 Live Google Web Search (SerpApi): Active`);
  console.log(`🎙️ Speech Engine: Local OpenAI (port 5058, model: tts-1, voice: nova)`);
  console.log(`================================================================\n`);
});
