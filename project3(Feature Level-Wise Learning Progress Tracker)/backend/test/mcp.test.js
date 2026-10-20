import assert from 'assert';
import { getStudentMcpConfig, saveStudentMcpConfig } from '../services/databaseService.js';
import { handleMcpChatIntent } from '../services/aiMentorService.js';

console.log('🧪 Running MCP Integration Unit Tests...');

const testStudentId = 'student-test-mcp-' + Date.now();

// 1. Initial configuration check
const initial = getStudentMcpConfig(testStudentId);
assert.strictEqual(initial.github.connected, false, 'Default GitHub should not be connected');
assert.strictEqual(initial.gmail.connected, false, 'Default Gmail should not be connected');
console.log('✅ Test 1 Passed: Initial student MCP config is cleanly unconfigured.');

// 2. Not connected intent prompt
async function testNotConnectedPrompt() {
  const res = await handleMcpChatIntent({
    query: 'Check my github repositories',
    queryLower: 'check my github repositories',
    studentId: testStudentId,
    context: {}
  });

  assert.ok(res, 'Should return MCP response');
  assert.strictEqual(res.type, 'mcp_connect_prompt');
  assert.strictEqual(res.service, 'github');
  assert.ok(res.reply.includes('GitHub MCP Not Connected Yet'), 'Should advise connecting GitHub');
  console.log('✅ Test 2 Passed: Chatbot gracefully handles disconnected GitHub with onboarding prompt.');
}

// 3. Save config and verify persistence
function testSaveConfig() {
  const saved = saveStudentMcpConfig(testStudentId, {
    github: {
      token: 'ghp_mock_token_1234567890',
      defaultOwner: 'testuser',
      defaultRepo: 'my-project',
      connected: true
    },
    gmail: {
      email: 'student@example.com',
      appPassword: 'mock app password',
      connected: true
    }
  });

  assert.strictEqual(saved.github.connected, true);
  assert.strictEqual(saved.github.defaultOwner, 'testuser');
  assert.strictEqual(saved.gmail.email, 'student@example.com');

  const reloaded = getStudentMcpConfig(testStudentId);
  assert.strictEqual(reloaded.github.token, 'ghp_mock_token_1234567890');
  assert.strictEqual(reloaded.gmail.email, 'student@example.com');
  console.log('✅ Test 3 Passed: MCP credentials successfully saved and retrieved per-student.');
}

// 4. Gmail disconnected intent prompt
async function testGmailNotConnectedPrompt() {
  const unconfiguredStudent = 'student-unconf-' + Date.now();
  const res = await handleMcpChatIntent({
    query: 'Check my gmail inbox',
    queryLower: 'check my gmail inbox',
    studentId: unconfiguredStudent,
    context: {}
  });

  assert.ok(res, 'Should return response for gmail query');
  assert.strictEqual(res.type, 'mcp_connect_prompt');
  assert.strictEqual(res.service, 'gmail');
  console.log('✅ Test 4 Passed: Chatbot gracefully handles disconnected Gmail with onboarding prompt.');
}

// 5. MCP General Status Hub Intent
async function testMcpHubIntent() {
  const res = await handleMcpChatIntent({
    query: 'How to connect MCP tools?',
    queryLower: 'how to connect mcp tools?',
    studentId: testStudentId,
    context: {}
  });

  assert.ok(res, 'Should return MCP hub response');
  assert.strictEqual(res.type, 'mcp_info');
  assert.ok(res.reply.includes('Model Context Protocol (MCP) Hub'));
  assert.ok(res.widgets?.[0]?.type === 'mcp_status_card');
  console.log('✅ Test 5 Passed: General MCP inquiries return status card and hub instructions.');
}

async function runAll() {
  await testNotConnectedPrompt();
  testSaveConfig();
  await testGmailNotConnectedPrompt();
  await testMcpHubIntent();
  console.log('\n========================================');
  console.log('🎉 ALL MCP INTEGRATION TESTS PASSED');
  console.log('========================================');
}

runAll().catch(err => {
  console.error('❌ MCP test failed:', err);
  process.exit(1);
});
