import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('\n================================================================');
console.log('🌟 LAUNCHING UNIFIED NEXT.JS AI STUDY MENTOR PLATFORM');
console.log('👉 SINGLE APP URL (Open in browser): http://localhost:5180');
console.log('================================================================');
console.log('⚛️ Full-Stack Next.js (App Router + API Routes + Sarvam AI + Teacher Luna)\n');

// 1. Launch Local Edge/OpenAI-Compatible TTS Server (Port 5058 - Optional)
const ttsServer = spawn('python', ['tts_server.py'], {
  cwd: __dirname,
  stdio: 'ignore',
  shell: false
});
ttsServer.on('error', () => {
  // TTS is optional, proceed cleanly if Python isn't installed
});

// 2. Launch Next.js Server on http://localhost:5180
const nextApp = spawn(npxCmd, ['next', 'dev', '-p', '5180'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: isWindows
});

function handleExit() {
  console.log('\n🛑 Shutting down AI Study Mentor services cleanly...');
  try { ttsServer.kill(); } catch (e) {}
  try { nextApp.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);
