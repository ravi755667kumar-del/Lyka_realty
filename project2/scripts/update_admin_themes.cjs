const fs = require('fs');
const path = require('path');

// Palette:
// Background: #fdfbf5
// Card / Container: #ffffff or #faf6ec
// Borders: #ebdcc4
// Primary Dark Text: #2d2216
// Secondary Text: #7d6851
// Muted Text: #a69279
// Gold / Amber Accent: #d97706 / amber-600

function updateAdminStats() {
  const file = path.join(__dirname, '../src/components/AdminStats.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // SVG Pie
  s = s.replace(/stroke="#0f172a"/g, 'stroke="#ffffff"');
  s = s.replace(/circle cx="100" cy="100" r="38" fill="#0f172a"/g, 'circle cx="100" cy="100" r="38" fill="#ffffff"');
  s = s.replace(/fill="white" fontSize="11"/g, 'fill="#2d2216" fontSize="11"');
  s = s.replace(/fill="white" fontSize="13"/g, 'fill="#2d2216" fontSize="13"');
  s = s.replace(/fill="#94a3b8"/g, 'fill="#7d6851"');
  s = s.replace(/hovered === i \? 'bg-slate-800' : ''/g, "hovered === i ? 'bg-[#faf6ec]' : ''");

  // Root container
  s = s.replace(/bg-slate-950 text-slate-300 overflow-y-auto/g, 'bg-[#fdfbf5] text-[#2d2216] overflow-y-auto');

  // Headers & buttons
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner/g,
    'bg-white border border-[#ebdcc4] rounded-xl p-1 shadow-2xs');

  // Cards & panels
  s = s.replace(/bg-slate-900 border border-slate-800 rounded-2xl p-4/g,
    'bg-white border border-[#ebdcc4] rounded-2xl p-4 shadow-xs');
  s = s.replace(/bg-slate-900 border border-slate-800 rounded-2xl p-5/g,
    'bg-white border border-[#ebdcc4] rounded-2xl p-5 shadow-xs');
  s = s.replace(/bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden/g,
    'bg-white border border-[#ebdcc4] rounded-2xl overflow-hidden shadow-xs');

  // Sort buttons
  s = s.replace(/bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700/g,
    'bg-white border-[#ebdcc4] text-[#7d6851] hover:text-[#2d2216] hover:border-amber-400');

  // Tables
  s = s.replace(/border-t border-slate-800 divide-y divide-slate-800\/60 bg-slate-950\/60/g,
    'border-t border-[#ebdcc4] divide-y divide-[#ebdcc4]/60 bg-[#faf6ec]');
  s = s.replace(/bg-slate-900\/60 font-semibold/g, 'bg-[#ebdcc4]/50 font-semibold text-[#5a4835]');
  s = s.replace(/hover:bg-slate-800\/40/g, 'hover:bg-[#faf6ec]');

  // Badges
  s = s.replace(/bg-slate-800\/80 border border-slate-700/g, 'bg-[#faf6ec] border border-[#ebdcc4]');
  s = s.replace(/bg-slate-800 rounded-full h-2/g, 'bg-[#ebdcc4] rounded-full h-2');

  // General text
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  fs.writeFileSync(file, s, 'utf8');
  console.log('AdminStats updated');
}

function updateAssignedPropertiesView() {
  const file = path.join(__dirname, '../src/components/AssignedPropertiesView.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // Root container
  s = s.replace(/bg-slate-950 text-slate-300 overflow-y-auto/g, 'bg-[#fdfbf5] text-[#2d2216] overflow-y-auto');

  // Cards and panels
  s = s.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900\/80 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-950/g, 'bg-white');
  s = s.replace(/bg-slate-900/g, 'bg-[#faf6ec]');
  s = s.replace(/border-slate-800/g, 'border-[#ebdcc4]');
  s = s.replace(/border-slate-700/g, 'border-[#ebdcc4]');

  // Text
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/text-slate-200/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  // Modals & popups
  s = s.replace(/bg-slate-950\/80/g, 'bg-black/60');
  s = s.replace(/bg-slate-950\/90/g, 'bg-black/60');

  fs.writeFileSync(file, s, 'utf8');
  console.log('AssignedPropertiesView updated');
}

function updateCustomerProfiles() {
  const file = path.join(__dirname, '../src/components/CustomerProfiles.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // Root container
  s = s.replace(/bg-slate-950 text-slate-300/g, 'bg-[#fdfbf5] text-[#2d2216]');

  // Panels & borders
  s = s.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900\/80/g, 'bg-white');
  s = s.replace(/bg-slate-900/g, 'bg-[#faf6ec]');
  s = s.replace(/bg-slate-950/g, 'bg-white');
  s = s.replace(/border-slate-800/g, 'border-[#ebdcc4]');
  s = s.replace(/border-slate-700/g, 'border-[#ebdcc4]');

  // Text
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/text-slate-200/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  fs.writeFileSync(file, s, 'utf8');
  console.log('CustomerProfiles updated');
}

function updateCustomerAnalytics() {
  const file = path.join(__dirname, '../src/components/CustomerAnalytics.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // Root container
  s = s.replace(/bg-slate-950 text-slate-300/g, 'bg-[#fdfbf5] text-[#2d2216]');

  // Panels & borders
  s = s.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900\/80/g, 'bg-white');
  s = s.replace(/bg-slate-900/g, 'bg-[#faf6ec]');
  s = s.replace(/bg-slate-950/g, 'bg-white');
  s = s.replace(/border-slate-800/g, 'border-[#ebdcc4]');
  s = s.replace(/border-slate-700/g, 'border-[#ebdcc4]');

  // Text
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/text-slate-200/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  fs.writeFileSync(file, s, 'utf8');
  console.log('CustomerAnalytics updated');
}

function updateAdminFavoritesView() {
  const file = path.join(__dirname, '../src/components/AdminFavoritesView.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // Root container
  s = s.replace(/bg-slate-950 text-slate-200/g, 'bg-[#fdfbf5] text-[#2d2216]');
  s = s.replace(/bg-slate-950 text-slate-300/g, 'bg-[#fdfbf5] text-[#2d2216]');

  // Panels & borders
  s = s.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900\/80/g, 'bg-white');
  s = s.replace(/bg-slate-900/g, 'bg-[#faf6ec]');
  s = s.replace(/bg-slate-950/g, 'bg-white');
  s = s.replace(/border-slate-800/g, 'border-[#ebdcc4]');
  s = s.replace(/border-slate-700/g, 'border-[#ebdcc4]');

  // Text
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/text-slate-200/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  fs.writeFileSync(file, s, 'utf8');
  console.log('AdminFavoritesView updated');
}

function updateSalesManagerDashboard() {
  const file = path.join(__dirname, '../src/components/SalesManagerDashboard.tsx');
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, 'utf8');

  // Hero header and containers
  s = s.replace(/bg-gradient-to-r from-emerald-950\/70 via-slate-900 to-slate-900 border-b border-emerald-800\/30/g,
    'bg-gradient-to-r from-emerald-50 via-[#faf6ec] to-amber-50 border-b border-[#ebdcc4]');

  s = s.replace(/bg-slate-950 text-slate-300/g, 'bg-[#fdfbf5] text-[#2d2216]');
  s = s.replace(/bg-slate-950/g, 'bg-[#fdfbf5]');
  s = s.replace(/bg-slate-900 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900\/80 border border-slate-800/g, 'bg-white border border-[#ebdcc4]');
  s = s.replace(/bg-slate-900/g, 'bg-[#faf6ec]');
  s = s.replace(/border-slate-800/g, 'border-[#ebdcc4]');
  s = s.replace(/border-slate-700/g, 'border-[#ebdcc4]');

  // Text
  s = s.replace(/text-slate-100/g, 'text-[#1c1611]');
  s = s.replace(/text-slate-200/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-300/g, 'text-[#2d2216]');
  s = s.replace(/text-slate-400/g, 'text-[#7d6851]');
  s = s.replace(/text-slate-500/g, 'text-[#8c765c]');

  fs.writeFileSync(file, s, 'utf8');
  console.log('SalesManagerDashboard updated');
}

updateAdminStats();
updateAssignedPropertiesView();
updateCustomerProfiles();
updateCustomerAnalytics();
updateAdminFavoritesView();
updateSalesManagerDashboard();
console.log('All admin theme updates finished successfully');
