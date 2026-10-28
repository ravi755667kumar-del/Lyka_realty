const fs = require('fs');
const path = require('path');

console.log('--- Fixing White Text in Admin Components ---');

// 1. AdminFavoritesView.tsx
const favFile = path.join(__dirname, '../src/components/AdminFavoritesView.tsx');
if (fs.existsSync(favFile)) {
  let s = fs.readFileSync(favFile, 'utf8');
  // Title
  s = s.replace(
    '<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">',
    '<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c1611]">'
  );
  // Metric total count
  s = s.replace(
    '<div className="text-xl sm:text-2xl font-black text-white">{metrics.total}</div>',
    '<div className="text-xl sm:text-2xl font-black text-[#1c1611]">{metrics.total}</div>'
  );
  // Empty state title
  s = s.replace(
    '<h3 className="text-base font-bold text-white">No Favorite Records Found</h3>',
    '<h3 className="text-base font-bold text-[#1c1611]">No Favorite Records Found</h3>'
  );
  fs.writeFileSync(favFile, s, 'utf8');
  console.log('✓ AdminFavoritesView: converted white titles & counts to #1c1611');
}

// 2. CustomerProfiles.tsx
const profFile = path.join(__dirname, '../src/components/CustomerProfiles.tsx');
if (fs.existsSync(profFile)) {
  let s = fs.readFileSync(profFile, 'utf8');
  // Leaderboard header
  s = s.replace(
    '<h3 className="text-xs sm:text-sm font-bold text-white">Most Active Customers Leaderboard</h3>',
    '<h3 className="text-xs sm:text-sm font-bold text-[#1c1611]">Most Active Customers Leaderboard</h3>'
  );
  // Customer item name
  s = s.replace(
    '<h4 className="text-sm font-bold text-white truncate">{item.user.Name || \'Anonymous Customer\'}</h4>',
    '<h4 className="text-sm font-bold text-[#1c1611] truncate">{item.user.Name || \'Anonymous Customer\'}</h4>'
  );
  // Customer email
  s = s.replace(
    '<span className="text-xs font-mono font-semibold text-white truncate block">',
    '<span className="text-xs font-mono font-semibold text-[#2d2216] truncate block">'
  );
  // Table user name
  s = s.replace(
    '<p className="font-semibold text-white truncate">{item.user.Name || \'Anonymous\'}</p>',
    '<p className="font-semibold text-[#1c1611] truncate">{item.user.Name || \'Anonymous\'}</p>'
  );
  // Modal title
  s = s.replace(
    '<h3 className="text-lg font-bold text-white flex items-center space-x-2">',
    '<h3 className="text-lg font-bold text-[#1c1611] flex items-center space-x-2">'
  );
  fs.writeFileSync(profFile, s, 'utf8');
  console.log('✓ CustomerProfiles: converted white customer names & headers to #1c1611');
}

// 3. CustomerAnalytics.tsx
const analFile = path.join(__dirname, '../src/components/CustomerAnalytics.tsx');
if (fs.existsSync(analFile)) {
  let s = fs.readFileSync(analFile, 'utf8');
  s = s.replace(
    '<p className="text-[10px] font-bold text-white">{item.subLabel}</p>',
    '<p className="text-[10px] font-bold text-[#2d2216]">{item.subLabel}</p>'
  );
  s = s.replace(
    '<span className="text-xs font-bold text-white flex items-center space-x-1.5">',
    '<span className="text-xs font-bold text-[#1c1611] flex items-center space-x-1.5">'
  );
  s = s.replace(
    '<span className="text-base font-extrabold text-white mt-0.5 block">{count}</span>',
    '<span className="text-base font-extrabold text-[#1c1611] mt-0.5 block">{count}</span>'
  );
  s = s.replace(
    '<h2 className="text-base font-bold text-white flex items-center space-x-2">',
    '<h2 className="text-base font-bold text-[#1c1611] flex items-center space-x-2">'
  );
  s = s.replace(
    '<p className="font-semibold text-white truncate">{u.Name || \'Customer\'}</p>',
    '<p className="font-semibold text-[#1c1611] truncate">{u.Name || \'Customer\'}</p>'
  );
  s = s.replace(
    '<h3 className="text-base font-bold text-white">{selectedUserDetail.Name || \'Customer Profile\'}</h3>',
    '<h3 className="text-base font-bold text-[#1c1611]">{selectedUserDetail.Name || \'Customer Profile\'}</h3>'
  );
  s = s.replace(
    '<p className="text-xs font-bold text-white font-mono mt-0.5">',
    '<p className="text-xs font-bold text-[#2d2216] font-mono mt-0.5">'
  );
  s = s.replace(
    '<span className="text-sm font-bold text-white mt-0.5 block">{selectedUserDetail.Age ? `${selectedUserDetail.Age} Years Old` : \'Not specified\'}</span>',
    '<span className="text-sm font-bold text-[#1c1611] mt-0.5 block">{selectedUserDetail.Age ? `${selectedUserDetail.Age} Years Old` : \'Not specified\'}</span>'
  );
  s = s.replace(
    '<span className="text-sm font-bold text-white mt-0.5 block">{selectedUserDetail.auth_provider || \'Email\'}</span>',
    '<span className="text-sm font-bold text-[#1c1611] mt-0.5 block">{selectedUserDetail.auth_provider || \'Email\'}</span>'
  );
  s = s.replace(
    '<span className="text-xs font-semibold text-white mt-0.5 block font-mono truncate">',
    '<span className="text-xs font-semibold text-[#2d2216] mt-0.5 block font-mono truncate">'
  );
  fs.writeFileSync(analFile, s, 'utf8');
  console.log('✓ CustomerAnalytics: converted white stats, names & emails to #1c1611 / #2d2216');
}

// 4. AdminStats.tsx
const statsFile = path.join(__dirname, '../src/components/AdminStats.tsx');
if (fs.existsSync(statsFile)) {
  let s = fs.readFileSync(statsFile, 'utf8');
  s = s.replace(
    '<span className="text-[11px] font-bold text-slate-200 flex-shrink-0">{slices[i].value}</span>',
    '<span className="text-[11px] font-bold text-[#1c1611] flex-shrink-0">{slices[i].value}</span>'
  );
  fs.writeFileSync(statsFile, s, 'utf8');
  console.log('✓ AdminStats: converted slice value to #1c1611');
}

// 5. AssignedPropertiesView.tsx
const assignFile = path.join(__dirname, '../src/components/AssignedPropertiesView.tsx');
if (fs.existsSync(assignFile)) {
  let s = fs.readFileSync(assignFile, 'utf8');
  // Gradient overlay behind title on property cards so text is always readable
  s = s.replace(
    /<div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">/g,
    '<div className="absolute inset-x-0 bottom-0 pt-6 pb-2 px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs">'
  );
  // Verification check strong text
  s = s.replace(
    /<strong className="text-white font-semibold">/g,
    '<strong className="text-[#1c1611] font-semibold">'
  );
  fs.writeFileSync(assignFile, s, 'utf8');
  console.log('✓ AssignedPropertiesView: added protective gradient behind card titles & converted text to #1c1611');
}

// 6. SalesManagerDashboard.tsx
const smFile = path.join(__dirname, '../src/components/SalesManagerDashboard.tsx');
if (fs.existsSync(smFile)) {
  let s = fs.readFileSync(smFile, 'utf8');
  // Fix bathrooms .trim()
  s = s.replace(
    'checkValid: (p) => Boolean(p.bathrooms && p.bathrooms.trim().length > 0)',
    'checkValid: (p) => Boolean(p.bathrooms && String(p.bathrooms).trim().length > 0)'
  );
  // Header
  s = s.replace(
    '<div className="text-xl font-black text-slate-100 mt-1">{properties.length}</div>',
    '<div className="text-xl font-black text-[#1c1611] mt-1">{properties.length}</div>'
  );
  fs.writeFileSync(smFile, s, 'utf8');
  console.log('✓ SalesManagerDashboard: fixed bathrooms checkValid & text colors');
}

console.log('--- All White Text Fixes Applied Successfully ---');
