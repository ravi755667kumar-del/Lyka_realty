import os

file_path = os.path.join("src", "components", "AgenticChat.tsx")
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Firebase imports
import_target = "} from 'lucide-react';"
import_replacement = """} from 'lucide-react';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';"""
content = content.replace(import_target, import_replacement, 1)

# 2. Add showAuthModal state
state_target = "const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);"
state_replacement = "const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);\n  const [showAuthModal, setShowAuthModal] = useState(false);"
content = content.replace(state_target, state_replacement, 1)

# 3. Add handleGoogleSignIn function and onUpdateLead to props
props_target = "sidebarOpen: boolean;"
props_replacement = "sidebarOpen: boolean;\n  onUpdateLead?: (updates: Partial<LeadProfile>) => void;"
content = content.replace(props_target, props_replacement, 1)

props_destruct_target = "sidebarOpen\n}) => {"
props_destruct_replacement = "sidebarOpen,\n  onUpdateLead\n}) => {"
content = content.replace(props_destruct_target, props_destruct_replacement, 1)

google_fn = """  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUserName(result.user.displayName || 'Customer');
      setUserEmail(result.user.email || '');
      setUserLoggedIn(true);
      setShowAuthModal(false);
      
      if (onUpdateLead) {
        onUpdateLead({
          id: result.user.uid,
          full_name: result.user.displayName || undefined,
          email: result.user.email || undefined
        });
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

"""
content = content.replace("const handleAuth = async (e: React.FormEvent) => {", google_fn + "  const handleAuth = async (e: React.FormEvent) => {", 1)

# Modify handleAuth to close modal
content = content.replace("setUserLoggedIn(true);", "setUserLoggedIn(true);\n      setShowAuthModal(false);", 1)


# 4. Extract Auth Section
start_marker = "{/* ─── USER AUTH SECTION ─── */}"
end_marker = "{/* ─── NEW CHAT BUTTON ─── */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

auth_section = content[start_idx:end_idx]

# Remove the auth section from the sidebar
content = content[:start_idx] + content[end_idx:]

# 5. Add Bottom Sidebar button
footer_code = """
            {/* ─── BOTTOM MENU / PROFILE BUTTON ─── */}
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
"""

# Place it right before the closing div of the left sidebar content
sidebar_end_idx = content.find("          </div>\n        )}")
content = content[:sidebar_end_idx] + footer_code + content[sidebar_end_idx:]


# 6. Add Modal Code
modal_content = auth_section.replace("p-3 border-b border-[#f3ede0] shrink-0", "p-4")

# Insert Google button into the modal
form_end_target = "</form>"
google_button = """</form>

                  <div className="flex items-center my-3">
                    <div className="flex-grow border-t border-slate-700"></div>
                    <span className="mx-2 text-[10px] font-bold text-slate-300">OR</span>
                    <div className="flex-grow border-t border-slate-700"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="w-full bg-white hover:bg-slate-200 text-black font-bold py-2 rounded-lg text-[12px] transition-colors flex items-center justify-center space-x-2 shadow-sm"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                    <span>Continue with Google</span>
                  </button>
"""
modal_content = modal_content.replace(form_end_target, google_button, 1)


modal_code = f"""
      {{/* ─── AUTH MODAL ─── */}}
      {{showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#ffffff] rounded-2xl w-full max-w-sm shadow-2xl border border-[#e2d9c6] overflow-hidden flex flex-col relative">
            <div className="flex justify-between items-center p-4 border-b border-[#f3ede0] bg-[#f7f2e6]">
              <h3 className="font-bold text-slate-700">Account</h3>
              <button onClick={{() => setShowAuthModal(false)}} className="text-slate-400 hover:text-slate-700 p-1 bg-white rounded-md border border-[#e2d9c6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {modal_content}
          </div>
        </div>
      )}}
"""

return_end = content.rfind("</div>\n  );\n};")
content = content[:return_end] + modal_code + content[return_end:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done!")
