const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'AgenticChat.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add showAuthModal state
content = content.replace(
  "const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);",
  "const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);\n  const [showAuthModal, setShowAuthModal] = useState(false);"
);

// 2. Extract Auth section
const startMarker = "{/* ─── USER AUTH SECTION ─── */}";
const endMarker = "{/* ─── NEW CHAT BUTTON ─── */}";

let startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf(endMarker);

// Fallback for weird character encoding in powershell/grep
if (startIndex === -1) startIndex = content.indexOf("USER AUTH SECTION");
if (endIndex === -1) endIndex = content.indexOf("NEW CHAT BUTTON");

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find auth markers");
  process.exit(1);
}

// Rewind to start of line for startMarker, advance to end of line for endMarker
startIndex = content.lastIndexOf("<div", startIndex);
endIndex = content.lastIndexOf("<div", endIndex);


const authCode = content.substring(startIndex, endIndex);

const newSidebarFooter = `
            {/* BOTTOM MENU / PROFILE BUTTON */}
            <div className="p-3 border-t border-[#f3ede0] shrink-0 bg-[#f7f2e6]">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-[#e2d9c6]"
              >
                <div className="flex items-center space-x-2">
                  <UserCircle className="w-5 h-5 text-slate-500" />
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-slate-700">{userLoggedIn ? userName : 'Account'}</p>
                    <p className="text-[9px] text-slate-500">{userLoggedIn ? 'Manage Profile' : 'Sign In / Sign Up'}</p>
                  </div>
                </div>
                <ChevronUp className="w-4 h-4 text-slate-400" />
              </button>
            </div>
`;

content = content.slice(0, startIndex) + content.slice(endIndex);

const leftPanelEnd = content.indexOf('          </div>\n        )}');
if (leftPanelEnd !== -1) {
  content = content.slice(0, leftPanelEnd) + newSidebarFooter + content.slice(leftPanelEnd);
} else {
  const leftPanelEnd2 = content.indexOf('</div>\n        )}');
  if (leftPanelEnd2 !== -1) {
      content = content.slice(0, leftPanelEnd2) + newSidebarFooter + content.slice(leftPanelEnd2);
  }
}

const modalCode = `
      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#ffffff] rounded-2xl w-full max-w-sm shadow-2xl border border-[#e2d9c6] overflow-hidden flex flex-col relative">
            <div className="flex justify-between items-center p-4 border-b border-[#f3ede0] bg-[#f7f2e6]">
              <h3 className="font-bold text-slate-700">Account</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700 p-1 bg-white rounded-md border border-[#e2d9c6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              ${authCode}
            </div>
          </div>
        </div>
      )}
`;

const returnEnd = content.lastIndexOf("</div>\n  );\n};");
if (returnEnd !== -1) {
  content = content.slice(0, returnEnd) + modalCode + content.slice(returnEnd);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Refactoring complete");
