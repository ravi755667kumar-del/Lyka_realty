import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\n================================================================');
console.log('🌟 LAUNCHING UNIFIED AI STUDY MENTOR PLATFORM');
console.log('================================================================');
console.log('🔗 Connecting Frontend + Backend + AI Model + RAG + Live Search + Voice TTS...\n');

// 1. Launch Local OpenAI-Compatible TTS Server (Port 5050)
console.log('🎙️  Starting Local OpenAI TTS Server on http://localhost:5050 ...');
const ttsServer = spawn('python', ['tts_server.py'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// 2. Launch Backend API Server (Port 5000)
console.log('📡 Starting Backend & RAG API Server on http://localhost:5000 ...');
const backend = spawn('node', ['backend/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// 3. Launch Frontend Client (Port 5173 with automatic /api proxy to Port 5000)
console.log('⚛️  Starting Frontend Development Server on http://localhost:5173 ...\n');
const frontend = spawn(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

function handleExit() {
  console.log('\n🛑 Shutting down AI Study Mentor services cleanly...');
  try { ttsServer.kill(); } catch (e) {}
  try { backend.kill(); } catch (e) {}
  try { frontend.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);
