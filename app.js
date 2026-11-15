const translations = {
    ar: {
        nav_history: "سجل المشاهدة", nav_requests: "طلباتي", nav_library: "المفضلة ومكتبتي",
        history_title: "سجل المشاهدة", requests_title: "طلباتي",
        lib_fav: "المفضلة", lib_reading: "أقرأها الآن", lib_want: "أريد قراءتها", lib_completed: "أنهيت قراءتها", lib_not_interested: "لا أرغب بقراءتها",
        empty_history: "لم تبدأ قراءة أي عمل بعد.", empty_requests: "لم ترسل أي طلبات حتى الآن.",
        btn_continue: "متابعة القراءة", btn_go_details: "صفحة العمل", btn_re_read: "إعادة القراءة",
        status_pending: "قيد المراجعة", status_needs_info: "تحتاج معلومات", status_approved: "مقبول", status_rejected: "مرفوض", status_completed: "مكتمل"
    },
    en: {
        nav_history: "History", nav_requests: "My Requests", nav_library: "My Library",
        history_title: "Reading History", requests_title: "My Requests",
        lib_fav: "Favorites", lib_reading: "Reading Now", lib_want: "Want to Read", lib_completed: "Completed", lib_not_interested: "Not Interested",
        empty_history: "You haven't started reading any work yet.", empty_requests: "You haven't sent any requests yet.",
        btn_continue: "Continue", btn_go_details: "Details", btn_re_read: "Re-read",
        status_pending: "Pending", status_needs_info: "Needs Info", status_approved: "Approved", status_rejected: "Rejected", status_completed: "Completed"
    }
};
let currentLang = localStorage.getItem('mg_lang') || 'ar';
function t(key) { return translations[currentLang][key] || key; }

const SUPABASE_URL = "https://jjsufiievudnuuxlsegz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YOtwjTMzDmv0oDuyhKh3ew_NrStjRu0";
let db = null;
try {
    if (SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL" && typeof supabase !== 'undefined') {
        db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) { console.error("Supabase init error:", e); }

document.addEventListener('contextmenu', event => {
    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
    }
});
document.addEventListener('selectstart', event => {
    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
    }
});

window.onerror = async function(message, source, lineno, colno, error) {
    if (typeof db === 'undefined' || !db) return;
    try {
        const userId = currentUser?.id || localStorage.getItem('mg_user_identifier');
        await db.from('error_logs').insert([{
            error_message: message,
            error_stack: error ? error.stack : `Line: ${lineno}, Col: ${colno} in ${source}`,
            user_agent: navigator.userAgent,
            user_id: userId
        }]);
    } catch (err) {}
};

window.addEventListener('unhandledrejection', async function(event) {
    if (typeof db === 'undefined' || !db) return;
    try {
        const userId = currentUser?.id || localStorage.getItem('mg_user_identifier');
        await db.from('error_logs').insert([{
            error_message: event.reason?.message || String(event.reason),
            error_stack: event.reason?.stack || 'No stack trace',
            user_agent: navigator.userAgent,
            user_id: userId
        }]);
    } catch (err) {}
});

let currentManhwaList = [];
let filteredManhwaList = [];
let previousSearchQueryLocation = 'home';
let lastLegalSourceView = 'home';
let currentOpenManhwaId = null;
let currentSelectedRating = 0;
let currentWorkComments = [];
let currentCommentContextType = 'work';
let currentCommentTargetChapterNum = null;
let currentCommentsSortOrder = 'latest';
let currentReplyingToCommentId = null;
let currentReplyingToUsername = null;
let editingCommentId = null;
let activeReportingCommentId = null;
let currentUser = null;
let chapterSortOrder = 'latest';
let readerChapterSortOrder = 'oldest';
let currentViewMode = localStorage.getItem('mg_mg_view_mode') || 'grid';
let searchDebounceTimer = null;

let isSpoilerActive = false; 
let isUserBanned = false;

let appSocialLinks = [];
let maintenanceTimerInterval = null;

let globalAvgRating = 7.5;
let readerOpenGeneration = 0;

let currentLibraryTab = 'favorite';
let currentHistoryTab = 'recent';
let currentReaderChapterId = null; 

let deletedNotifIds = []; try { deletedNotifIds = JSON.parse(localStorage.getItem('mg_deleted_notif_ids')) || []; } catch(e) {}
if (deletedNotifIds.length > 500) { deletedNotifIds = deletedNotifIds.slice(-200); localStorage.setItem('mg_deleted_notif_ids', JSON.stringify(deletedNotifIds)); }

let appNotifications = []; try { appNotifications = JSON.parse(localStorage.getItem('mg_notifications')) || []; } catch(e) {}
appNotifications = appNotifications.filter(n => !deletedNotifIds.includes(n.id));

let notifPreferences = { followed: true, fav: true, news: true }; try { notifPreferences = JSON.parse(localStorage.getItem('mg_notif_prefs')) || { followed: true, fav: true, news: true }; } catch(e) {}
let readerSettings = { direction: 'vertical', tapNavigate: true, tapMode: 'both', scrollbarEnabled: true, scrollbarPos: 'bottom', fullscreen: false, pageGap: 0 }; try { readerSettings = JSON.parse(localStorage.getItem('mg_reader_settings')) || { direction: 'vertical', tapNavigate: true, tapMode: 'both', scrollbarEnabled: true, scrollbarPos: 'bottom', fullscreen: false, pageGap: 0 }; } catch(e) {}
let pdfReaderState = { manhwaId: null, chapterNum: null, pages: [], hudsVisible: true };

let ALL_CATEGORIES = [];

let activeFilters = { type: 'all', status: 'all', chapRange: 'all', sort: 'popular', categories: [] };
let searchHistory = []; try { searchHistory = JSON.parse(localStorage.getItem('mg_search_history')) || []; } catch(e) {}

window._commentTexts = {};

let currentConfirmAction = null;

// --- دوال مساعدة للتكامل الأصلي (Native Helpers) ---
async function triggerNativeHaptic(style = 'LIGHT') {
    try {
        if (window.Capacitor && window.Capacitor.Plugins.Haptics) {
            await window.Capacitor.Plugins.Haptics.impact({ style });
        }
    } catch (e) {}
}

async function copyTextNative(text) {
    try {
        if (window.Capacitor && window.Capacitor.Plugins.Clipboard) {
            await window.Capacitor.Plugins.Clipboard.write({ string: text });
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
        }
        triggerNativeHaptic('LIGHT');
        return true;
    } catch (e) {
        return false;
    }
}

async function openExternalUrlNative(url) {
    if (!url) return;
    try {
        if (window.Capacitor && window.Capacitor.Plugins.Browser) {
            await window.Capacitor.Plugins.Browser.open({ url });
        } else {
            window.open(url, '_system');
        }
    } catch (e) {
        window.location.href = url;
    }
}

// --- إصلاح زر الرجوع الأصلي باستخدام @capacitor/app ---
let lastBackPressTime = 0;
if (window.Capacitor && window.Capacitor.Plugins.App) {
    const { App } = window.Capacitor.Plugins;
    App.addListener('backButton', () => {
        const readerChapters = document.getElementById('readerChaptersOverlay');
        if (readerChapters && readerChapters.style.display === 'flex') { readerChapters.style.display = 'none'; return; }
        const readerSettings = document.getElementById('readerSettingsPanel');
        if (readerSettings && readerSettings.style.display === 'flex') { closeReaderSettingsPanel(); return; }
        if (document.getElementById('readerView').classList.contains('active')) { closePdfReader(); return; }

        const modalsToClose = [
            'authOverlay', 'guestGateOverlay', 'rulesModalOverlay',
            'optionsModalOverlay', 'reportModalOverlay', 'reportWorkModalOverlay',
            'ratingModalOverlay', 'titleModalOverlay', 'requestModalOverlay',
            'notificationConfirmModalOverlay', 'downloadConfirmOverlay'
        ];
        for (const mId of modalsToClose) {
            const el = document.getElementById(mId);
            if (el && el.style.display === 'flex') { el.style.display = 'none'; return; }
        }

        if (document.getElementById('confirmationBottomSheetModal').classList.contains('show')) { closeConfirmationSheet(); return; }
        if (document.getElementById('addToLibraryModal').classList.contains('show')) { closeAddToLibraryModal(); return; }
        if (document.getElementById('newRequestModal').classList.contains('show')) {
            document.getElementById('newRequestModal').classList.remove('show');
            setTimeout(() => document.getElementById('newRequestModal').style.display = 'none', 300);
            return;
        }
        if (document.getElementById('sideDrawer').classList.contains('open')) { toggleDrawer(true); return; }
        if (document.getElementById('advancedSearchModal').style.display === 'flex') { closeAdvancedSearch(); return; }
        if (document.getElementById('offlineOverlay').style.display === 'flex') {
            document.getElementById('offlineOverlay').style.display = 'none';
            return;
        }

        const activeView = document.querySelector('.view.active');
        if (activeView) {
            if (activeView.id === 'commentsPageView') {
                document.getElementById('commentsPageBackBtn')?.click();
                return;
            }
            if (activeView.id === 'detailsView') {
                navigateTo(previousSearchQueryLocation || 'home');
                return;
            }
            if (['privacyView', 'termsView', 'faqView', 'aboutView'].includes(activeView.id)) {
                goBackFromLegal();
                return;
            }
            if (activeView.id !== 'homeView') {
                navigateTo('home');
                return;
            }
        }

        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
            App.exitApp();
        } else {
            lastBackPressTime = now;
            triggerNativeHaptic('LIGHT');
            const exitToast = document.getElementById('exitToast');
            if (exitToast) {
                exitToast.classList.add('show');
                setTimeout(() => exitToast.classList.remove('show'), 2000);
            }
        }
    });
}

function showConfirmationSheet(title, desc, btnText, action) {
    document.getElementById('confirmSheetTitle').innerText = title;
    document.getElementById('confirmSheetDesc').innerText = desc;
    const btn = document.getElementById('confirmSheetBtnYes');
    btn.innerHTML = btnText;
    currentConfirmAction = action;
    
    const modal = document.getElementById('confirmationBottomSheetModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeConfirmationSheet() {
    const modal = document.getElementById('confirmationBottomSheetModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
    currentConfirmAction = null;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(message, type = 'info', duration = 3000) {
    if (type === 'success' || type === 'info') return;
    
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    if (container.children.length >= 3) {
        container.removeChild(container.firstChild);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = { error: 'circle-exclamation' };
    toast.innerHTML = `<i class="fa-solid fa-${iconMap[type] || 'circle-info'}"></i><span>${escapeHtml(String(message))}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

(function() {
    const _nativeAlert = window.alert;
    window.alert = function(msg) {
        if (typeof showToast === 'function') showToast(String(msg), 'info', 3500);
        else _nativeAlert.call(window, msg);
    };
})();

window.onscroll = function() {
    var btn = document.getElementById("backToTopBtn");
    if (!btn) return;
    var privacyActive = document.getElementById('privacyView')?.classList.contains('active');
    var termsActive = document.getElementById('termsView')?.classList.contains('active');
    var faqActive = document.getElementById('faqView')?.classList.contains('active');
    btn.style.display = ((privacyActive || termsActive || faqActive) && (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300)) ? "flex" : "none";
};

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function isUserLoggedIn() { return currentUser !== null || localStorage.getItem('mg_is_authenticated') === 'true'; }

function checkGuestPermission(actionType) {
    if (isUserLoggedIn()) return true;
    const gateOverlay = document.getElementById('guestGateOverlay');
    const gateTitle = document.getElementById('guestGateTitle');
    const gateMsg = document.getElementById('guestGateMessage');
    const messages = {
        comments: { title: "التعليقات", msg: "يمكنك قراءة التعليقات لكن لا يمكنك المشاركة دون تسجيل الدخول." },
        rating: { title: "تقييم العمل", msg: "لتقييم العمل، عليك تسجيل الدخول أولاً." },
        download: { title: "تنزيل الفصل", msg: "لتتمكن من تنزيل الفصول، سجّل الدخول أولاً." },
        fav: { title: "المفضلة", msg: "لتتمكن من إضافة العمل إلى مكتبتك، سجّل الدخول أولاً." },
        request: { title: "إرسال طلب", msg: "لإرسال طلب للإدارة، سجّل الدخول أولاً." }
    };
    const m = messages[actionType] || { title: "تسجيل الدخول مطلوب", msg: "عذراً، يجب عليك تسجيل الدخول." };
    gateTitle.innerText = m.title; gateMsg.innerText = m.msg;
    gateOverlay.style.display = 'flex';
    return false;
}
function closeGuestGateModal() { document.getElementById('guestGateOverlay').style.display = 'none'; }

async function checkUserBanStatus() {
    if (!db || !currentUser) return;
    try {
        const { data, error } = await db.from('profiles').select('is_banned, ban_until, mute_until').eq('id', currentUser.id).single();
        if (!error && data) {
            const now = new Date();
            const isPermanentlyBanned = data.is_banned === true;
            const isTemporarilyBanned = data.ban_until && new Date(data.ban_until) > now;
            const isMuted = data.mute_until && new Date(data.mute_until) > now;
            isUserBanned = isPermanentlyBanned || isTemporarilyBanned || isMuted;
        }
    } catch (err) {}
}

function updateCommentInputState() {
    const input = document.getElementById('indepCommentInput');
    const sendBtn = document.getElementById('indepSendCommentBtn');
    const hkBtn = document.getElementById('spoilerToggleBtn');
    const emojiBtn = document.getElementById('emojiPickerToggleBtn');

    if (!input || !sendBtn) return;

    if (isUserBanned) {
        input.placeholder = "لقد تم حظرك أو كتمك من التعليق بسبب مخالفة قواعد المجتمع.";
        input.disabled = true;
        input.style.opacity = '0.6';
        input.style.cursor = 'not-allowed';
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        sendBtn.style.cursor = 'not-allowed';
        if(hkBtn) { hkBtn.disabled = true; hkBtn.style.opacity = '0.5'; }
        if(emojiBtn) { emojiBtn.disabled = true; emojiBtn.style.opacity = '0.5'; }
    } else {
        input.placeholder = "اكتب تعليقك هنا...";
        input.disabled = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
        if(hkBtn) { hkBtn.disabled = false; hkBtn.style.opacity = '1'; }
        if(emojiBtn) { emojiBtn.disabled = false; emojiBtn.style.opacity = '1'; }
    }
}

async function initAuthSystem() {
    if (!db) { updateProfileUI(); return; }
    try {
        const { data: { session } } = await db.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            localStorage.setItem('mg_username', currentUser.user_metadata?.username || currentUser.email.split('@')[0]);
            localStorage.setItem('mg_user_identifier', currentUser.id);
            localStorage.setItem('mg_is_authenticated', 'true');
            await checkUserBanStatus(); 
        } else { currentUser = null; localStorage.removeItem('mg_is_authenticated'); }
        
        db.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                localStorage.setItem('mg_username', currentUser.user_metadata?.username || currentUser.email.split('@')[0]);
                localStorage.setItem('mg_user_identifier', currentUser.id);
                localStorage.setItem('mg_is_authenticated', 'true');
                await checkUserBanStatus(); 
            } else { currentUser = null; localStorage.removeItem('mg_username'); localStorage.removeItem('mg_is_authenticated'); isUserBanned = false; }
            updateProfileUI();
            if (document.getElementById('commentsPageView').classList.contains('active')) {
                fetchIndependentComments(currentOpenManhwaId, currentCommentContextType === 'chapter' ? currentCommentTargetChapterNum : null);
                updateCommentInputState(); 
            }
        });
    } catch (err) { console.error("Auth init error:", err); }
    updateProfileUI();
}

function updateProfileUI() {
    const drawerName = document.getElementById('drawerUsername');
    const profileName = document.getElementById('profileUsernameText');
    const profileEmail = document.getElementById('profileEmailText');
    const logoutBtn = document.getElementById('profileLogoutBtn');
    const deleteBtn = document.getElementById('profileDeleteAccountBtn');
    const loginTrigger = document.getElementById('profileLoginTriggerBtn');
    const username = localStorage.getItem('mg_username');
    if (isUserLoggedIn() && username) {
        if (drawerName) drawerName.innerText = username;
        if (profileName) profileName.innerText = username;
        if (profileEmail) profileEmail.innerText = currentUser ? currentUser.email : '';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (deleteBtn) deleteBtn.style.display = 'block';
        if (loginTrigger) loginTrigger.style.display = 'none';
    } else {
        if (drawerName) drawerName.innerText = 'زائر';
        if (profileName) profileName.innerText = 'زائر';
        if (profileEmail) profileEmail.innerText = 'غير مسجل الدخول';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (loginTrigger) loginTrigger.style.display = 'block';
    }
}

function renderAuthModalState(state = 'login') {
    const overlay = document.getElementById('authOverlay');
    const box = document.getElementById('authBoxContainer');
    if (!overlay || !box) return;
    overlay.style.display = 'flex';
    
    const closeBtn = `<div style="width:100%; display:flex; justify-content:flex-end; margin-bottom:10px;"><button class="header-action-icon" onclick="document.getElementById('authOverlay').style.display='none'"><i class="fa-solid fa-xmark" style="font-size:1.4rem;"></i></button></div>`;
    const logoHtml = `<div class="auth-logo-new"><img src="https://azerhamid59-lgtm.github.io/manhwa_gerx/icon.png" alt="Logo" onerror="this.src='https://via.placeholder.com/80/15151a/e50914?text=MG'"></div>`;
    
    if (state === 'login' || state === 'main') {
        box.className = 'auth-container-new';
        box.innerHTML = `
            ${closeBtn}
            ${logoHtml}
            <h2 class="auth-title-new">مرحباً بعودتك</h2>
            <p class="auth-subtitle-new">سجل الدخول لمتابعة قراءتك ومزامنة مفضلتك عبر أجهزتك</p>
            
            <div class="auth-input-group-new">
                <label class="auth-label-new">البريد الإلكتروني</label>
                <div class="auth-input-wrapper-new">
                    <input type="email" id="loginEmailInput" placeholder="example@email.com" oninput="validateLoginFormInputs()">
                    <i class="fa-solid fa-envelope input-icon"></i>
                </div>
            </div>
            
            <div class="auth-input-group-new">
                <label class="auth-label-new">كلمة المرور</label>
                <div class="auth-input-wrapper-new">
                    <input type="password" id="loginPassInput" placeholder="••••••••" oninput="validateLoginFormInputs()">
                    <button class="eye-btn" onclick="togglePasswordVisibility('loginPassInput', this)"><i class="fa-solid fa-eye"></i></button>
                    <i class="fa-solid fa-lock input-icon" style="margin-left:0; margin-right:10px;"></i>
                </div>
            </div>
            
            <div class="auth-row-new">
                <label><input type="checkbox" id="rememberMeCheckbox"> تذكرني</label>
                <a href="#" onclick="alert('سيتم إرسال رابط الاستعادة لبريدك قريباً.')">نسيت كلمة المرور؟</a>
            </div>
            
            <button class="auth-btn-primary-new" id="submitLoginBtn" onclick="handleEmailLogin()">تسجيل الدخول</button>
            
            <div class="auth-divider-new">أو تابع باستخدام</div>
            
            <button class="auth-btn-google-new" id="btnGoogleAuth" onclick="handleGoogleOAuth()">
                <i class="fa-brands fa-google" style="color:#EA4335;"></i> الدخول عبر حساب Google
            </button>
            
            <div class="auth-footer-new">
                ليس لديك حساب؟ <a href="#" onclick="renderAuthModalState('register')">إنشاء حساب جديد</a>
            </div>
        `;
    } else if (state === 'register') {
        box.className = 'auth-container-new';
        box.innerHTML = `
            ${closeBtn}
            ${logoHtml}
            <h2 class="auth-title-new">إنشاء حساب جديد</h2>
            <p class="auth-subtitle-new">انضم لمجتمع Manhwa Gerx واحتفظ بمفضلاتك</p>
            
            <div class="avatar-upload-new">
                <div class="avatar-circle-new"><i class="fa-solid fa-user"></i></div>
                <span class="avatar-text-new">أضف صورة مخصصة (اختياري)</span>
            </div>

            <div class="auth-input-group-new">
                <label class="auth-label-new">الاسم الكامل</label>
                <div class="auth-input-wrapper-new">
                    <input type="text" id="regUsernameInput" placeholder="اسمك الكامل">
                    <i class="fa-solid fa-user input-icon"></i>
                </div>
            </div>
            
            <div class="auth-input-group-new">
                <label class="auth-label-new">البريد الإلكتروني</label>
                <div class="auth-input-wrapper-new">
                    <input type="email" id="regEmailInput" placeholder="example@email.com">
                    <i class="fa-solid fa-envelope input-icon"></i>
                </div>
            </div>
            
            <div class="auth-input-group-new">
                <label class="auth-label-new">كلمة المرور</label>
                <div class="auth-input-wrapper-new">
                    <input type="password" id="regPassInput" placeholder="8 أحرف على الأقل" oninput="updatePasswordStrength(this.value)">
                    <button class="eye-btn" onclick="togglePasswordVisibility('regPassInput', this)"><i class="fa-solid fa-eye"></i></button>
                    <i class="fa-solid fa-lock input-icon" style="margin-left:0; margin-right:10px;"></i>
                </div>
                <div class="password-strength-new">
                    <div class="strength-bar-new" id="strengthBar1"></div>
                    <div class="strength-bar-new" id="strengthBar2"></div>
                    <div class="strength-bar-new" id="strengthBar3"></div>
                </div>
                <span style="font-size:0.65rem; color:var(--text-secondary); margin-top:4px; display:block;">استخدم مزيجاً من الأحرف والأرقام لقوة أكبر</span>
            </div>
            
            <div class="auth-input-group-new">
                <label class="auth-label-new">تأكيد كلمة المرور</label>
                <div class="auth-input-wrapper-new">
                    <input type="password" id="regConfirmPassInput" placeholder="أعد كتابة كلمة المرور">
                    <button class="eye-btn" onclick="togglePasswordVisibility('regConfirmPassInput', this)"><i class="fa-solid fa-eye"></i></button>
                    <i class="fa-solid fa-lock input-icon" style="margin-left:0; margin-right:10px;"></i>
                </div>
            </div>
            
            <div class="auth-row-new" style="justify-content: flex-start; margin-top: 10px;">
                <label><input type="checkbox" id="termsCheckbox" style="width:16px; height:16px;"> أوافق على <a href="#" onclick="navigateTo('terms')" style="margin:0;">شروط الاستخدام</a> و <a href="#" onclick="navigateTo('privacy')" style="margin:0;">سياسة الخصوصية</a> الخاصة بـ Manhwa Gerx</label>
            </div>
            
            <button class="auth-btn-primary-new" id="submitRegisterBtn" onclick="handleEmailRegister()">إنشاء الحساب</button>
            
            <div class="auth-divider-new">أو تابع باستخدام</div>
            
            <button class="auth-btn-google-new" id="btnGoogleAuth" onclick="handleGoogleOAuth()">
                <i class="fa-brands fa-google" style="color:#EA4335;"></i> الدخول عبر حساب Google
            </button>
            
            <div class="auth-footer-new">
                لديك حساب بالفعل؟ <a href="#" onclick="renderAuthModalState('login')">تسجيل الدخول</a>
            </div>
        `;
    }
}

function updatePasswordStrength(val) {
    const bars = [document.getElementById('strengthBar1'), document.getElementById('strengthBar2'), document.getElementById('strengthBar3')];
    bars.forEach(b => { if(b) b.classList.remove('active'); });
    if (val.length > 0 && bars[0]) bars[0].classList.add('active');
    if (val.length >= 6 && bars[1]) bars[1].classList.add('active');
    if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val) && bars[2]) bars[2].classList.add('active');
}

function validateLoginFormInputs() {
    const emailVal = document.getElementById('loginEmailInput')?.value.trim() || '';
    const passVal = document.getElementById('loginPassInput')?.value || '';
    const submitBtn = document.getElementById('submitLoginBtn');
    if (!submitBtn) return;
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    const isPassValid = passVal.length >= 6;
    const errEl = document.getElementById('emailErrorMsg');
    if (errEl) errEl.style.display = (emailVal.length > 0 && !isEmailValid) ? 'flex' : 'none';
    submitBtn.classList.toggle('btn-submit-active', isEmailValid && isPassValid);
    submitBtn.classList.toggle('btn-submit-disabled', !(isEmailValid && isPassValid));
    submitBtn.disabled = !(isEmailValid && isPassValid);
}

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId); if (!input) return;
    if (input.type === 'password') { input.type = 'text'; btnEl.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`; }
    else { input.type = 'password'; btnEl.innerHTML = `<i class="fa-solid fa-eye"></i>`; }
}

async function handleEmailLogin() {
    const email = document.getElementById('loginEmailInput').value.trim();
    const password = document.getElementById('loginPassInput').value;
    if (!email || !password || !db) return;
    const btn = document.getElementById('submitLoginBtn');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري...`; btn.disabled = true;
    try {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        document.getElementById('authOverlay').style.display = 'none';
        updateProfileUI();
    } catch (err) { showToast("خطأ في البريد أو كلمة المرور.", "error"); }
    finally { btn.innerHTML = `تسجيل الدخول`; btn.disabled = false; }
}

async function handleEmailRegister() {
    const username = document.getElementById('regUsernameInput').value.trim();
    const email = document.getElementById('regEmailInput').value.trim();
    const password = document.getElementById('regPassInput').value;
    const confirmPass = document.getElementById('regConfirmPassInput').value;
    const termsChecked = document.getElementById('termsCheckbox').checked;
    if (!username || !email || !password || !confirmPass) { showToast("الرجاء تعبئة جميع الحقول.", "error"); return; }
    if (password !== confirmPass) { showToast("كلمتا المرور غير متطابقتين.", "error"); return; }
    if (password.length < 6) { showToast("كلمة المرور قصيرة جداً.", "error"); return; }
    if (!termsChecked) { showToast("يجب الموافقة على الشروط.", "error"); return; }
    if (!db) return;
    const btn = document.getElementById('submitRegisterBtn');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; btn.disabled = true;
    try {
        const { data, error } = await db.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (data.user) { document.getElementById('authOverlay').style.display = 'none'; updateProfileUI(); }
    } catch (err) { showToast("خطأ: " + (err.message || 'غير معروف'), "error"); }
    finally { btn.innerHTML = `إنشاء الحساب`; btn.disabled = false; }
}

async function handleGoogleOAuth() {
    if (!db) return;
    try {
        if (!window.Capacitor || !window.Capacitor.Plugins.SocialLogin) {
            showToast("تسجيل الدخول بجوجل غير مدعوم في المتصفح.", "error");
            return;
        }

        const res = await window.Capacitor.Plugins.SocialLogin.login({
            provider: 'google',
            options: {
                filterByAuthorizedAccounts: false
            }
        });

        const idToken = res.result.idToken;

        if (!idToken) {
            throw new Error("لم يتم استلام ID Token من جوجل.");
        }

        const { data, error } = await db.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
        });

        if (error) throw error;

        document.getElementById('authOverlay').style.display = 'none';
        updateProfileUI();
        showToast("تم تسجيل الدخول بنجاح!", "success");

    } catch (err) {
        console.error("Google Auth Error:", err);
        showToast("الخطأ: " + (err.message || JSON.stringify(err)), "error", 10000); 
    }
}

async function handleLogout() {
    showConfirmationSheet('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟', 'خروج', async () => {
        if (db) await db.auth.signOut();
        currentUser = null; localStorage.removeItem('mg_username'); localStorage.removeItem('mg_is_authenticated');
        updateProfileUI(); navigateTo('home');
    });
}

async function handleDeleteAccount() {
    if (!checkGuestPermission('request')) return;
    showConfirmationSheet('حذف الحساب', 'هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ سيتم إرسال طلب للإدارة للمراجعة.', 'إرسال الطلب', async () => {
        try {
            const username = localStorage.getItem('mg_username') || 'مستخدم';
            const { error } = await db.from('requests').insert([{
                user_id: currentUser.id,
                username: username,
                type: 'طلب حذف حساب',
                title: 'طلب حذف حساب نهائي',
                description: 'المستخدم طلب حذف حسابه نهائياً من التطبيق.',
                status: 'pending'
            }]);
            if (error) throw error;
            showToast("تم إرسال طلب الحذف للإدارة بنجاح.", "success", 5000);
        } catch (err) { showToast("حدث خطأ أثناء إرسال الطلب.", "error"); }
    });
}

function openRequestModal() {
    if (!checkGuestPermission('request')) return;
    document.getElementById('requestModalOverlay').style.display = 'flex';
}

async function submitUserRequest() {
    if (!currentUser) return;
    const type = document.getElementById('requestType').value;
    const title = document.getElementById('requestTitle').value.trim();
    const desc = document.getElementById('requestDesc').value.trim();
    if (!title || !desc) { showToast("الرجاء تعبئة العنوان والتفاصيل.", "error"); return; }

    const btn = document.getElementById('submitRequestBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...'; btn.disabled = true;

    try {
        const { error } = await db.from('requests').insert([{
            user_id: currentUser.id,
            username: localStorage.getItem('mg_username') || 'مستخدم',
            type: type,
            title: title,
            description: desc,
            status: 'pending'
        }]);
        if (error) throw error;
        document.getElementById('requestModalOverlay').style.display = 'none';
        document.getElementById('requestTitle').value = '';
        document.getElementById('requestDesc').value = '';
    } catch (err) {
        showToast("خطأ: " + err.message, "error");
    } finally {
        btn.innerHTML = 'إرسال الطلب'; btn.disabled = false;
    }
}

function toggleDrawer(forceClose = false) {
    const drawer = document.getElementById('sideDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (!drawer || !overlay) return;
    if (forceClose) { drawer.classList.remove('open'); overlay.style.display = 'none'; }
    else { const isOpen = drawer.classList.toggle('open'); overlay.style.display = isOpen ? 'block' : 'none'; }
}

function openAdvancedSearch() { document.getElementById('advancedSearchModal').style.display = 'flex'; }
function closeAdvancedSearch() { document.getElementById('advancedSearchModal').style.display = 'none'; }

function toggleViewMode() {
    currentViewMode = currentViewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('mg_mg_view_mode', currentViewMode);
    updateViewToggleIcon();
    if (document.getElementById('homeView').classList.contains('active')) renderActiveMainGrid();
    if (document.getElementById('searchPageView').classList.contains('active')) executeLiveSearch();
}
function updateViewToggleIcon() {
    const icon = document.getElementById('viewToggleIcon');
    if (icon) icon.className = currentViewMode === 'grid' ? 'fa-solid fa-grip' : 'fa-solid fa-list';
}

function getFavorites() { return JSON.parse(localStorage.getItem('mg_favorites')) || []; }
function toggleFavorite(id) {
    if (!checkGuestPermission('fav')) return;
    let favs = getFavorites();
    if (favs.includes(id)) favs = favs.filter(f => f !== id); else favs.push(id);
    localStorage.setItem('mg_favorites', JSON.stringify(favs));
    updateLibraryButtonState(id);
}
    
async function fetchUserLibrary() {
    if (!currentUser) { renderGridSimple([], 'favGrid'); return; }
    try {
        const { data, error } = await db.from('user_library').select('manhwa_id, list_type').eq('user_id', currentUser.id);
        if (error) throw error;
        
        const libStats = { favorite: 0, reading: 0, want_to_read: 0, completed: 0, not_interested: 0 };
        const listData = { favorite: [], reading: [], want_to_read: [], completed: [], not_interested: [] };
        
        data.forEach(item => {
            if (libStats[item.list_type] !== undefined) libStats[item.list_type]++;
            if (listData[item.list_type]) listData[item.list_type].push(item.manhwa_id);
        });

        document.getElementById('libStatFav').innerText = libStats.favorite;
        document.getElementById('libStatReading').innerText = libStats.reading;
        document.getElementById('libStatWant').innerText = libStats.want_to_read;
        document.getElementById('libStatCompleted').innerText = libStats.completed;

        const items = currentManhwaList.filter(m => listData[currentLibraryTab].includes(m.id));
        renderGridSimple(items, 'favGrid');
    } catch (err) { console.error(err); }
}

function switchLibraryTab(tab) {
    currentLibraryTab = tab;
    document.querySelectorAll('#libraryTabs .lib-tab').forEach(el => el.classList.toggle('active', el.getAttribute('data-ltab') === tab));
    if (isUserLoggedIn()) fetchUserLibrary();
    else renderGridSimple([], 'favGrid');
}

async function openAddToLibraryModal(manhwaId) {
    if (!checkGuestPermission('fav')) return;
    const modal = document.getElementById('addToLibraryModal');
    const listContainer = document.getElementById('libraryOptionsList');
    listContainer.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    modal.style.display = 'flex'; setTimeout(() => modal.classList.add('show'), 10);

    try {
        const { data } = await db.from('user_library').select('list_type').eq('user_id', currentUser.id).eq('manhwa_id', manhwaId);
        const userLists = data ? data.map(d => d.list_type) : [];
        const lists = [
            { id: 'favorite', icon: 'fa-heart', name: 'المفضلة', desc: 'الأعمال التي تحبها' },
            { id: 'reading', icon: 'fa-book-open', name: 'أقرأها الآن', desc: 'الأعمال التي تقرأها حالياً' },
            { id: 'want_to_read', icon: 'fa-bookmark', name: 'أريد قراءتها', desc: 'الأعمال التي تخطط لقراءتها' },
            { id: 'completed', icon: 'fa-circle-check', name: 'أنهيت قراءتها', desc: 'الأعمال التي أكملتها' },
            { id: 'not_interested', icon: 'fa-ban', name: 'لا أرغب بقراءتها', desc: 'الأعمال التي لا تهمك' }
        ];
        
        listContainer.innerHTML = '';
        lists.forEach(l => {
            const isSelected = userLists.includes(l.id);
            const div = document.createElement('div');
            div.className = `lib-select-item ${isSelected ? 'selected' : ''}`;
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <i class="fa-solid ${l.icon}" style="color: ${isSelected ? 'var(--accent)' : 'var(--text-secondary)'}; font-size:1.2rem;"></i>
                    <div>
                        <div style="font-weight:700; color:${isSelected ? 'var(--accent)' : '#fff'}; font-size:0.85rem;">${l.name}</div>
                        <div style="font-size:0.65rem; color:var(--text-secondary);">${l.desc}</div>
                    </div>
                </div>
                ${isSelected ? '<i class="fa-solid fa-check-circle" style="color:var(--accent);"></i>' : '<i class="fa-regular fa-circle" style="color:var(--text-secondary);"></i>'}
            `;
            div.onclick = () => toggleLibrarySelection(manhwaId, l.id, isSelected);
            listContainer.appendChild(div);
        });
    } catch (err) {
        listContainer.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ أثناء جلب المكتبة.</p>';
    }
}

function closeAddToLibraryModal() {
    const modal = document.getElementById('addToLibraryModal');
    modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300);
    if (document.getElementById('favView').classList.contains('active')) fetchUserLibrary();
    updateLibraryButtonState(currentOpenManhwaId);
}

async function toggleLibrarySelection(manhwaId, listType, isSelected) {
    if (!currentUser) return;
    try {
        await db.from('user_library').delete().eq('user_id', currentUser.id).eq('manhwa_id', manhwaId).in('list_type', ['favorite', 'reading', 'want_to_read', 'completed', 'not_interested']);
        if (!isSelected) {
            await db.from('user_library').insert({ user_id: currentUser.id, manhwa_id: manhwaId, list_type: listType });
        }
        openAddToLibraryModal(manhwaId);
        updateLibraryButtonState(manhwaId);
    } catch (err) { showToast("فشل التعديل.", "error"); }
}

async function updateLibraryButtonState(manhwaId) {
    if (!manhwaId || !currentUser) return;
    const { data } = await db.from('user_library').select('list_type').eq('user_id', currentUser.id).eq('manhwa_id', manhwaId).in('list_type', ['favorite', 'reading', 'want_to_read', 'completed', 'not_interested']);
    const has = data && data.length > 0;
    const favLabel = document.getElementById('favBtnLabel'), favBtnIcon = document.getElementById('favBtnIcon'), btnLib = document.getElementById('btnLibrary');
    if (has) { favLabel.innerText = "في المكتبة"; favBtnIcon.className = "fa-solid fa-bookmark"; btnLib.classList.add('active-action'); }
    else { favLabel.innerText = "أضف للمكتبة"; favBtnIcon.className = "fa-solid fa-square-plus"; btnLib.classList.remove('active-action'); }
}

async function loadReadingHistoryView() {
    if (!currentUser) { document.getElementById('historyContentArea').innerHTML = '<p class="empty-state-text">يرجى تسجيل الدخول لعرض سجلك.</p>'; return; }
    const container = document.getElementById('historyContentArea');
    container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    
    try {
        const { data, error } = await db.from('reading_history').select('*').eq('user_id', currentUser.id).order('last_read_at', { ascending: false });
        if (error) throw error;
        
        document.getElementById('hStatTotalChaps').innerText = data.length;
        document.getElementById('hStatCompleted').innerText = data.filter(d => d.status === 'completed').length;
        document.getElementById('hStatWorks').innerText = new Set(data.map(d => d.manhwa_id)).size;

        renderHistoryTabContent(data);
    } catch (err) { container.innerHTML = '<p class="empty-state-text">حدث خطأ أثناء جلب السجل.</p>'; }
}

function switchHistoryTab(tab) {
    currentHistoryTab = tab;
    document.querySelectorAll('#historyTabs .lib-tab').forEach(el => el.classList.toggle('active', el.getAttribute('data-htab') === tab));
    loadReadingHistoryView();
}

function renderHistoryTabContent(data) {
    const container = document.getElementById('historyContentArea');
    if (data.length === 0) { container.innerHTML = '<p class="empty-state-text">لم تبدأ قراءة أي عمل بعد.</p>'; return; }

    let html = '';
    if (currentHistoryTab === 'recent') {
        const worksMap = {};
        data.forEach(h => { if (!worksMap[h.manhwa_id]) worksMap[h.manhwa_id] = h; });
        const recentWorks = Object.values(worksMap);
        recentWorks.forEach(h => {
            const manhwa = currentManhwaList.find(m => m.id === h.manhwa_id);
            if (!manhwa) return;
            
            let progressHtml = '';
            if (h.status !== 'completed') {
                const ch = manhwa?.chapters?.find(c => parseFloat(c.num) === parseFloat(h.chapter_num));
                const totalPages = ch?.pages_count || 0;
                const currentPage = h.last_page_index || 0;
                const pct = totalPages > 0 ? Math.min(100, Math.round(((currentPage + 1) / totalPages) * 100)) : 0;
                progressHtml = `
                    <div class="hc-progress-bar" style="margin-top: 4px;"><div class="hc-progress-fill" style="width:${pct}%"></div></div>
                    <div style="font-size:0.6rem; color:var(--accent); margin-top:2px;">تقدم القراءة: ${pct}%</div>
                `;
            }

            html += `<div class="history-card">
                <img src="${escapeHtml(manhwa.cover)}" class="hc-img" onclick="openDetails('${manhwa.id}')">
                <div class="hc-details">
                    <div>
                        <div class="hc-title" onclick="openDetails('${manhwa.id}')">${escapeHtml(manhwa.title)}</div>
                        <div class="hc-meta">آخر قراءة: الفصل ${formatChapterNum(h.chapter_num)} • ${formatRelativeArabicTime(h.last_read_at)}</div>
                        ${progressHtml}
                    </div>
                    <button class="btn-apply" style="padding:6px; font-size:0.75rem; width:fit-content; margin-top:8px;" onclick="openChapterFromList('${manhwa.id}', ${h.chapter_num})">${t('btn_continue')}</button>
                </div>
            </div>`;
        });
    } else if (currentHistoryTab === 'chapters') {
        data.forEach(h => {
            const manhwa = currentManhwaList.find(m => m.id === h.manhwa_id);
            if (!manhwa) return;
            
            let progressHtml = '';
            if (h.status !== 'completed') {
                const ch = manhwa?.chapters?.find(c => parseFloat(c.num) === parseFloat(h.chapter_num));
                const totalPages = ch?.pages_count || 0;
                const currentPage = h.last_page_index || 0;
                const pct = totalPages > 0 ? Math.min(100, Math.round(((currentPage + 1) / totalPages) * 100)) : 0;
                progressHtml = `
                    <div class="hc-progress-bar" style="margin-top: 4px;"><div class="hc-progress-fill" style="width:${pct}%"></div></div>
                    <div style="font-size:0.6rem; color:var(--accent); margin-top:2px;">تقدم القراءة: ${pct}%</div>
                `;
            }

            html += `<div class="history-card">
                <img src="${escapeHtml(manhwa.cover)}" class="hc-img">
                <div class="hc-details">
                    <div>
                        <div class="hc-title">${escapeHtml(manhwa.title)}</div>
                        <div class="hc-meta">الفصل ${formatChapterNum(h.chapter_num)} • ${h.status === 'completed' ? 'مكتمل' : 'قيد القراءة'} • ${formatRelativeArabicTime(h.last_read_at)}</div>
                        ${progressHtml}
                    </div>
                    <button class="btn-reset" style="padding:6px; font-size:0.75rem; width:fit-content; margin-top:8px;" onclick="openChapterFromList('${manhwa.id}', ${h.chapter_num})">${t('btn_go_details')}</button>
                </div>
            </div>`;
        });
    } else if (currentHistoryTab === 'completed') {
        const comp = data.filter(h => h.status === 'completed');
        if (comp.length === 0) { container.innerHTML = '<p class="empty-state-text">لا توجد فصول مكتملة.</p>'; return; }
        comp.forEach(h => {
            const manhwa = currentManhwaList.find(m => m.id === h.manhwa_id);
            if (!manhwa) return;
            html += `<div class="history-card">
                <img src="${escapeHtml(manhwa.cover)}" class="hc-img">
                <div class="hc-details">
                    <div>
                        <div class="hc-title">${escapeHtml(manhwa.title)}</div>
                        <div class="hc-meta">الفصل ${formatChapterNum(h.chapter_num)} • ${formatRelativeArabicTime(h.completed_at || h.last_read_at)}</div>
                    </div>
                    <button class="btn-apply" style="padding:6px; font-size:0.75rem; width:fit-content; margin-top:8px; background:#2ecc71;" onclick="openChapterFromList('${manhwa.id}', ${h.chapter_num})">${t('btn_re_read')}</button>
                </div>
            </div>`;
        });
    } else if (currentHistoryTab === 'timeline') {
        const grouped = {};
        data.forEach(h => {
            const date = new Date(h.last_read_at).toLocaleDateString('en-GB');
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(h);
        });
        for (const date in grouped) {
            html += `<h4 style="color:var(--accent); margin: 12px 0 8px; font-size:0.85rem;">${date}</h4>`;
            grouped[date].forEach(h => {
                const manhwa = currentManhwaList.find(m => m.id === h.manhwa_id);
                if (manhwa) html += `<div style="padding:8px; border-bottom:1px solid var(--border); font-size:0.8rem; display:flex; justify-content:space-between;"><span>${escapeHtml(manhwa.title)} - فصل ${h.chapter_num}</span><span style="color:var(--text-secondary);">${new Date(h.last_read_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}</span></div>`;
            });
        }
    }
    container.innerHTML = html;
}

async function saveReadingProgress(manhwaId, chapterId, chapterNum, pageIndex, isCompleted = false) {
    if (!currentUser || !chapterId) return;
    try {
        const payload = { user_id: currentUser.id, manhwa_id: manhwaId, chapter_id: chapterId, chapter_num: chapterNum, last_page_index: pageIndex, last_read_at: new Date().toISOString(), status: isCompleted ? 'completed' : 'reading' };
        if (isCompleted) payload.completed_at = new Date().toISOString();
        
        await db.from('reading_history').upsert(payload, { onConflict: 'user_id,chapter_id' });
    } catch (err) { console.error("Error saving history:", err); }
}

function clearReadingHistory() {
    if (!checkGuestPermission('history')) return;
    showConfirmationSheet(
        'حذف سجل المشاهدة',
        'هل أنت متأكد من مسح سجل المشاهدة بالكامل؟ سيتم إزالة جميع سجلات القراءة نهائياً.',
        'حذف السجل',
        async () => {
            try {
                await db.from('reading_history').delete().eq('user_id', currentUser.id);
                loadReadingHistoryView();
            } catch (e) { showToast("حدث خطأ أثناء الحذف", "error"); }
        }
    );
}

function clearUserRequests() {
    if (!checkGuestPermission('request')) return;
    showConfirmationSheet(
        'حذف سجل الطلبات',
        'هل أنت متأكد من مسح جميع طلباتك؟ سيتم حذف سجلات الطلبات وإعادة تعيين الإحصائيات نهائياً.',
        'حذف السجل',
        async () => {
            try {
                await db.from('requests').delete().eq('user_id', currentUser.id);
                fetchUserRequests();
            } catch (e) { showToast("حدث خطأ أثناء الحذف", "error"); }
        }
    );
}

async function fetchUserRequests() {
    if (!currentUser) { document.getElementById('requestsListContainer').innerHTML = '<p class="empty-state-text">يرجى تسجيل الدخول لعرض طلباتك.</p>'; return; }
    const container = document.getElementById('requestsListContainer');
    container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    try {
        const { data, error } = await db.from('requests').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (error) throw error;

        document.getElementById('rStatTotal').innerText = data.length;
        document.getElementById('rStatPending').innerText = data.filter(r => r.status === 'pending').length;
        document.getElementById('rStatApproved').innerText = data.filter(r => r.status === 'approved').length;
        document.getElementById('rStatRejected').innerText = data.filter(r => r.status === 'rejected').length;

        if (data.length === 0) { container.innerHTML = '<p class="empty-state-text">لم ترسل أي طلبات حتى الآن.</p>'; return; }
        
        let html = '';
        data.forEach(r => {
            let badgeClass = 'sb-pending', statusText = t('status_pending');
            if (r.status === 'approved') { badgeClass = 'sb-approved'; statusText = t('status_approved'); }
            else if (r.status === 'rejected') { badgeClass = 'sb-rejected'; statusText = t('status_rejected'); }
            else if (r.status === 'needs_info') { badgeClass = 'sb-needs_info'; statusText = t('status_needs_info'); }
            else if (r.status === 'completed') { badgeClass = 'sb-completed'; statusText = t('status_completed'); }

            html += `<div class="request-card">
                <div class="hc-details">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div class="hc-title">${escapeHtml(r.title)}</div>
                            <span class="status-badge ${badgeClass}">${statusText}</span>
                        </div>
                        <div class="hc-meta" dir="rtl">رقم الطلب: <span dir="ltr">${r.request_number || '—'}</span> • <span dir="ltr">${new Date(r.created_at).toLocaleDateString('en-GB')}</span></div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:6px;">${escapeHtml(r.description || '')}</div>
                        ${r.admin_reply ? `<div style="background:rgba(255,42,95,0.1); padding:8px; border-radius:8px; margin-top:8px; font-size:0.75rem; border-right:3px solid var(--accent);"><strong>رد الإدارة:</strong> ${escapeHtml(r.admin_reply)}</div>` : ''}
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (err) { container.innerHTML = '<p class="empty-state-text">حدث خطأ أثناء جلب الطلبات.</p>'; }
}

function openNewRequestModal() {
    if (!checkGuestPermission('request')) return;
    const modal = document.getElementById('newRequestModal');
    document.getElementById('newReqTitle').value = '';
    document.getElementById('newReqDesc').value = '';
    modal.style.display = 'flex'; setTimeout(() => modal.classList.add('show'), 10);
}

function toggleRequestFields() {
    const type = document.getElementById('newReqType').value;
    document.getElementById('reqManhwaField').style.display = (type === 'add_chapter') ? 'block' : 'none';
}

async function submitNewRequest() {
    const type = document.getElementById('newReqType').value;
    const title = document.getElementById('newReqTitle').value.trim();
    const desc = document.getElementById('newReqDesc').value.trim();
    if (!title) { showToast("العنوان مطلوب.", "error"); return; }

    const btn = document.getElementById('newReqSubmitBtn');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري...'; btn.disabled = true; }
    try {
        const { error } = await db.from('requests').insert({
            user_id: currentUser.id, username: localStorage.getItem('mg_username') || 'مستخدم',
            title: title, type: type, request_type: type, description: desc, status: 'pending'
        });
        if (error) throw error;
        document.getElementById('newRequestModal').classList.remove('show');
        setTimeout(() => document.getElementById('newRequestModal').style.display = 'none', 300);
        fetchUserRequests();
    } catch (err) { showToast("خطأ: " + err.message, "error"); }
    finally { if(btn) { btn.innerHTML = 'إرسال الطلب'; btn.disabled = false; } }
}

let _readChaptersCache = null, _readCacheTime = 0;
function invalidateReadChaptersCache() { _readChaptersCache = null; _readCacheTime = 0; }

function getReadChapters() {
    const now = Date.now();
    if (_readChaptersCache && (now - _readCacheTime) < 5000) return _readChaptersCache;
    let rawData = JSON.parse(localStorage.getItem('mg_read_chapters')) || {};
    let timestampsData = JSON.parse(localStorage.getItem('mg_read_timestamps')) || {};
    let cleanData = {}, cleanTimestamps = {};
    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000;
    let changed = false;
    
    Object.keys(rawData).forEach(mId => {
        let chList = rawData[mId], timeMap = timestampsData[mId] || {};
        if (Array.isArray(chList)) {
            let validChs = [], validTimeMap = {};
            chList.forEach(chNum => {
                const readTime = timeMap[chNum] || now;
                if ((now - readTime) < twoMonthsMs) { validChs.push(Number(chNum)); validTimeMap[chNum] = readTime; }
                else changed = true;
            });
            if (validChs.length > 0) { cleanData[mId] = [...new Set(validChs)]; cleanTimestamps[mId] = validTimeMap; }
            else if (chList.length > 0) changed = true;
        }
    });
    if (changed) { try { localStorage.setItem('mg_read_chapters', JSON.stringify(cleanData)); localStorage.setItem('mg_read_timestamps', JSON.stringify(cleanTimestamps)); } catch (e) {} }
    _readChaptersCache = cleanData; _readCacheTime = now;
    return cleanData;
}

function getReadingHistory() { return JSON.parse(localStorage.getItem('mg_history')) || []; }
function addToHistory(manhwaId, manhwaTitle, cover, chNum) {
    let history = getReadingHistory();
    history = history.filter(h => !(h.manhwaId === manhwaId && h.chNum === chNum));
    history.unshift({ manhwaId, manhwaTitle, cover, chNum, time: new Date().toLocaleDateString('en-GB') });
    if (history.length > 30) history.pop();
    localStorage.setItem('mg_history', JSON.stringify(history));
}

function markChapterAsRead(manhwaId, chNum) {
    let readData = getReadChapters();
    let timestampsData = JSON.parse(localStorage.getItem('mg_read_timestamps')) || {};
    if (!readData[manhwaId]) readData[manhwaId] = [];
    if (!timestampsData[manhwaId]) timestampsData[manhwaId] = {};
    const currentNum = parseFloat(chNum);
    const manhwa = currentManhwaList.find(m => m.id === manhwaId);
    const allChapters = (manhwa?.chapters || []).map(c => parseFloat(c.num));
    const previousChapters = allChapters.filter(n => n <= currentNum);
    previousChapters.forEach(n => {
        if (!readData[manhwaId].includes(n)) { readData[manhwaId].push(n); timestampsData[manhwaId][n] = Date.now(); }
    });
    localStorage.setItem('mg_read_chapters', JSON.stringify(readData));
    localStorage.setItem('mg_read_timestamps', JSON.stringify(timestampsData));
    let lastReadMap = JSON.parse(localStorage.getItem('mg_last_read')) || {};
    lastReadMap[manhwaId] = currentNum;
    localStorage.setItem('mg_last_read', JSON.stringify(lastReadMap));
    invalidateReadChaptersCache();
}

function formatRelativeArabicTime(dateInput) {
    if (!dateInput) return 'منذ لحظات';
    const date = new Date(dateInput), now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'منذ لحظات';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) { if (diffMin === 1) return 'منذ دقيقة'; if (diffMin === 2) return 'منذ دقيقتين'; return `منذ ${diffMin} دقيقة`; }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) { if (diffHours === 1) return 'منذ ساعة'; if (diffHours === 2) return 'منذ ساعتين'; return `منذ ${diffHours} ساعة`; }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'أمس'; if (diffDays === 2) return 'منذ يومين';
    if (diffDays < 30) return `منذ ${diffDays} يوم`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return 'منذ شهر'; if (diffMonths === 2) return 'منذ شهرين';
    if (diffMonths < 12) return `منذ ${diffMonths} شهر`;
    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return 'منذ عام'; return `منذ ${diffYears} عام`;
}

function formatChapterNum(num) {
    if (num === undefined || num === null) return '00';
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return num;
    if (parsed < 10 && parsed % 1 === 0) return '0' + parsed;
    return String(parsed);
}

function saveToSearchHistory(query) {
    const cleanQuery = query.trim(); if (!cleanQuery) return;
    searchHistory = searchHistory.filter(item => item !== cleanQuery);
    searchHistory.unshift(cleanQuery);
    if (searchHistory.length > 15) searchHistory.pop();
    localStorage.setItem('mg_search_history', JSON.stringify(searchHistory));
    renderSearchHistoryUI();
}

function renderSearchHistoryUI() {
    const listEl = document.getElementById('searchHistoryList');
    const sectionEl = document.getElementById('searchHistorySection');
    const query = document.getElementById('liveSearchInput').value.trim();
    if (!listEl || !sectionEl) return;
    if (query.length > 0 || searchHistory.length === 0) { sectionEl.style.display = 'none'; return; }
    sectionEl.style.display = 'block'; listEl.innerHTML = '';
    searchHistory.forEach(item => {
        const pill = document.createElement('div');
        pill.className = 'history-pill';
        pill.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i><span>${escapeHtml(item)}</span><i class="fa-solid fa-xmark del-item"></i>`;
        pill.querySelector('span').addEventListener('click', () => {
            document.getElementById('liveSearchInput').value = item;
            document.getElementById('clearSearchTextBtn').style.display = 'block';
            executeLiveSearch();
        });
        pill.querySelector('.del-item').addEventListener('click', (e) => {
            e.stopPropagation();
            searchHistory = searchHistory.filter(h => h !== item);
            localStorage.setItem('mg_search_history', JSON.stringify(searchHistory));
            renderSearchHistoryUI();
        });
        listEl.appendChild(pill);
    });
}
function clearAllSearchHistory() { 
    showConfirmationSheet('حذف سجل البحث', 'هل تريد مسح جميع عمليات البحث الأخيرة؟', 'حذف', () => {
        searchHistory = []; localStorage.removeItem('mg_search_history'); renderSearchHistoryUI(); 
    });
}

function renderCategoriesFilterUI() {
    const container = document.getElementById('categoryFilters'); if (!container) return;
    container.innerHTML = '';
    if (ALL_CATEGORIES.length === 0) {
        container.innerHTML = '<span class="empty-state-text" style="min-height: auto; padding: 10px;">لا توجد تصنيفات متاحة.</span>';
        return;
    }
    ALL_CATEGORIES.forEach(cat => {
        const pill = document.createElement('span');
        pill.className = `filter-pill ${activeFilters.categories.includes(cat) ? 'selected' : ''}`;
        pill.setAttribute('data-cat', cat); pill.innerText = cat;
        pill.addEventListener('click', () => {
            pill.classList.toggle('selected');
            if (pill.classList.contains('selected')) { if (!activeFilters.categories.includes(cat)) activeFilters.categories.push(cat); }
            else { activeFilters.categories = activeFilters.categories.filter(c => c !== cat); }
        });
        container.appendChild(pill);
    });
}

function getSocialIconHtml(platform) {
    switch(platform) {
        case 'facebook': return '<i class="fa-brands fa-facebook" style="color: #1877F2; font-size: 1.2rem;"></i>';
        case 'youtube': return '<i class="fa-brands fa-youtube" style="color: #FF0000; font-size: 1.2rem;"></i>';
        case 'instagram': return '<i class="fa-brands fa-instagram" style="color: #E1306C; font-size: 1.2rem;"></i>';
        case 'telegram': return '<i class="fa-brands fa-telegram" style="color: #0088cc; font-size: 1.2rem;"></i>';
        case 'tiktok': return '<i class="fa-brands fa-tiktok" style="color: #000; background: #fff; border-radius: 50%; padding: 3px; font-size: 1rem; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"></i>';
        case 'twitter': return '<i class="fa-brands fa-x-twitter" style="color: #000; background: #fff; border-radius: 50%; padding: 3px; font-size: 1rem; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;"></i>';
        default: return '<i class="fa-solid fa-globe" style="color: var(--accent); font-size: 1.2rem;"></i>';
    }
}

function renderAppSocialLinks() {
    const containers = [document.getElementById('socialLinksContainerApp'), document.getElementById('socialLinksAboutContainer')];
    containers.forEach(container => {
        if (!container) return;
        container.innerHTML = '';
        if (!appSocialLinks || appSocialLinks.length === 0) return;
        let html = `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
            <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; text-align: center;">تابعنا على</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">`;
        appSocialLinks.forEach(link => {
            const iconHtml = getSocialIconHtml(link.platform);
            const title = link.title || link.platform;
            html += `
                <div onclick="openExternalUrlNative('${escapeHtml(link.url)}')" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--border); padding: 12px 16px; border-radius: 12px; color: #fff; font-size: 0.85rem; font-weight: 700;">
                    <span style="display: flex; align-items: center; gap: 10px;">${iconHtml}${escapeHtml(title)}</span>
                    <i class="fa-solid fa-arrow-left" style="color: var(--text-secondary); font-size: 0.8rem;"></i>
                </div>
            `;
        });
        html += `</div></div>`;
        container.innerHTML = html;
    });
}

function startMaintenanceTimer(endTimeStr) {
    const endTime = new Date(endTimeStr).getTime();
    const container = document.getElementById('maintenanceTimerContainer');
    container.style.display = 'flex';
    
    if (maintenanceTimerInterval) clearInterval(maintenanceTimerInterval);
    
    maintenanceTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        
        if (distance < 0) {
            clearInterval(maintenanceTimerInterval);
            document.getElementById('timerDays').innerText = '00';
            document.getElementById('timerHours').innerText = '00';
            document.getElementById('timerMinutes').innerText = '00';
            document.getElementById('timerSeconds').innerText = '00';
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        document.getElementById('timerDays').innerText = String(days).padStart(2, '0');
        document.getElementById('timerHours').innerText = String(hours).padStart(2, '0');
        document.getElementById('timerMinutes').innerText = String(minutes).padStart(2, '0');
        document.getElementById('timerSeconds').innerText = String(seconds).padStart(2, '0');
    }, 1000);
}

async function fetchAppSettings() {
    if (!db) return;
    try {
        const { data, error } = await db.from('app_settings').select('*').eq('id', 1).single();
        if (!error && data) {
            if (data.maintenance_mode) {
                document.getElementById('maintenanceOverlay').style.display = 'flex';
                document.body.style.overflow = 'hidden'; 
                if (data.maintenance_end_time) {
                    startMaintenanceTimer(data.maintenance_end_time);
                }
            }
            
            if (data.app_version) {
                document.getElementById('drawerVersionText').innerText = data.app_version;
                document.getElementById('appVersionText').innerText = data.app_version;
            }
            
            if (data.welcome_message) {
                const lastWelcome = localStorage.getItem('mg_last_welcome_msg');
                if (lastWelcome !== data.welcome_message) {
                    const notifId = 'welcome_' + Date.now();
                    appNotifications.unshift({
                        id: notifId,
                        title: 'مرحباً بك في Manhwa Gerx',
                        desc: data.welcome_message,
                        time: new Date().toLocaleDateString('en-GB'),
                        rawTime: Date.now(),
                        unread: true,
                        type: "welcome"
                    });
                    localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
                    localStorage.setItem('mg_last_welcome_msg', data.welcome_message);
                    renderNotificationsList();
                }
            }
            
            appSocialLinks = data.social_links || [];
            renderAppSocialLinks();
        }
    } catch (err) { console.error("خطأ في جلب الإعدادات:", err); }
}

async function fetchCategories() {
    if (!db) return;
    try {
        const { data, error } = await db.from('categories').select('name');
        if (!error && data && data.length > 0) {
            ALL_CATEGORIES = data.map(c => c.name);
            renderCategoriesFilterUI();
        }
    } catch (err) { console.error("خطأ في جلب التصنيفات:", err); }
}

async function fetchSingleManhwa(id) {
    if (!db) return null;
    try {
        const { data: manhwaData, error: manhwaError } = await db.from('manhwa').select('*').eq('id', id).single();
        if (manhwaError) throw manhwaError;
        
        const { data: chaptersData, error: chaptersError } = await db.from('chapters').select('*').eq('manhwa_id', id);
        if (chaptersError) throw chaptersError;
        
        let latestDate = new Date(manhwaData.created_at || 0);
        (chaptersData || []).forEach(ch => {
            const chDate = new Date(ch.created_at || 0);
            if (chDate > latestDate) latestDate = chDate;
        });

        return {
            ...manhwaData, isNew: manhwaData.is_new || manhwaData.isNew || false,
            status: manhwaData.status === 'مستمر' ? 'مستمرة' : (manhwaData.status === 'مكتمل' ? 'مكتملة' : (manhwaData.status || 'مستمرة')),
            views: manhwaData.views || 0, 
            rating_average: parseFloat(manhwaData.rating_average) || 0,
            rating_count: parseInt(manhwaData.rating_count) || 0,
            age_rating: manhwaData.age_rating || manhwaData.ageRating || null,
            has_content_warning: manhwaData.has_content_warning || manhwaData.content_warning || false,
            chapters: (chaptersData || []).sort((a, b) => parseFloat(a.num) - parseFloat(b.num)),
            last_updated_at: latestDate.toISOString()
        };
    } catch (err) { console.error("Error fetching single manhwa:", err); return null; }
}

async function fetchManhwaFromDB(forceRefresh = false) {
    if (currentManhwaList.length > 0 && !forceRefresh) return currentManhwaList;
    if (!db) { currentManhwaList = []; filteredManhwaList = []; return currentManhwaList; }
    try {
        const [manhwaRes, chaptersRes] = await Promise.all([
            db.from('manhwa').select('*'),
            db.from('chapters').select('*')
        ]);
        const manhwaData = manhwaRes.data;
        const chaptersData = chaptersRes.data;
        const error = manhwaRes.error;

        if (error || !manhwaData || manhwaData.length === 0) { currentManhwaList = []; filteredManhwaList = []; return []; }
        
        const chaptersByManhwa = {};
        (chaptersData || []).forEach(ch => {
            if (!chaptersByManhwa[ch.manhwa_id]) chaptersByManhwa[ch.manhwa_id] = [];
            chaptersByManhwa[ch.manhwa_id].push(ch);
        });

        currentManhwaList = manhwaData.map(item => {
            const itemChapters = chaptersByManhwa[item.id] || [];
            let latestDate = new Date(item.created_at || 0);
            itemChapters.forEach(ch => {
                const chDate = new Date(ch.created_at || 0);
                if (chDate > latestDate) latestDate = chDate;
            });
            return {
                ...item, isNew: item.is_new || item.isNew || false,
                status: item.status === 'مستمر' ? 'مستمرة' : (item.status === 'مكتمل' ? 'مكتملة' : (item.status || 'مستمرة')),
                views: item.views || 0, 
                rating_average: parseFloat(item.rating_average) || 0,
                rating_count: parseInt(item.rating_count) || 0,
                age_rating: item.age_rating || item.ageRating || null,
                has_content_warning: item.has_content_warning || item.content_warning || false,
                chapters: itemChapters,
                last_updated_at: latestDate.toISOString()
            };
        });

        currentManhwaList.sort((a, b) => new Date(b.last_updated_at) - new Date(a.last_updated_at));

        const ratedManhwa = currentManhwaList.filter(m => m.rating_count > 0);
        if (ratedManhwa.length > 0) {
            const totalAvg = ratedManhwa.reduce((sum, m) => sum + m.rating_average, 0);
            globalAvgRating = totalAvg / ratedManhwa.length;
        } else {
            globalAvgRating = 7.5;
        }

    } catch (err) { console.error("Fetch manhwa error:", err); currentManhwaList = []; }
    filteredManhwaList = currentManhwaList;
    return currentManhwaList;
}

async function fetchAnnouncements() {
    if (!db) return;
    try {
        const { data, error } = await db.from('announcements').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            const dbIds = data.map(item => 'ann_' + item.id);
            appNotifications = appNotifications.filter(n => n.type !== 'announcement' || dbIds.includes(n.id));
            let newNotifs = data.map(item => ({
                id: 'ann_' + item.id, title: item.title, desc: item.description,
                time: new Date(item.created_at).toLocaleDateString('en-GB'),
                rawTime: new Date(item.created_at).getTime(), unread: true, type: "announcement"
            }));
            let existingIds = appNotifications.map(n => n.id);
            newNotifs.forEach(n => { if (!existingIds.includes(n.id) && !deletedNotifIds.includes(n.id) && notifPreferences.news) appNotifications.unshift(n); });
            appNotifications.sort((a, b) => b.rawTime - a.rawTime);
            localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
            renderNotificationsList();
        }
    } catch (err) { console.error(err); }
}

async function fetchUserDBNotifications() {
    if (!db || !currentUser) return;
    try {
        const { data, error } = await db.from('user_notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            let addedAny = false;
            data.forEach((notif) => {
                const cleanTitle = notif.title.replace(/[✅❌]/g, '').trim();
                const cleanMsg = notif.message.replace(/[✅❌]/g, '').trim();
                
                const exists = appNotifications.some(n => n.desc === cleanMsg && n.title === cleanTitle);
                if (!exists) {
                    appNotifications.unshift({
                        id: notif.id,
                        title: cleanTitle,
                        desc: cleanMsg,
                        time: new Date(notif.created_at).toLocaleDateString('en-GB'),
                        rawTime: new Date(notif.created_at).getTime(),
                        unread: true,
                        type: "system"
                    });
                    addedAny = true;
                }
            });
            
            if (addedAny) {
                localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
                renderNotificationsList();
            }

            const notifIds = data.map(n => n.id);
            await db.from('user_notifications').update({ is_read: true }).in('id', notifIds);
        }
    } catch (err) {
        console.error("خطأ في جلب إشعارات المراقب:", err);
    }
}

function setupUserNotificationsRealtime() {
    if (!db || !currentUser) return;
    db.channel('user-notifs')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'user_notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, payload => {
            const cleanTitle = payload.new.title.replace(/[✅❌]/g, '').trim();
            const cleanMsg = payload.new.message.replace(/[✅❌]/g, '').trim();
            
            const exists = appNotifications.some(n => n.desc === cleanMsg && n.title === cleanTitle);
            if (!exists) {
                appNotifications.unshift({
                    id: payload.new.id,
                    title: cleanTitle,
                    desc: cleanMsg,
                    time: new Date().toLocaleDateString('en-GB'),
                    rawTime: Date.now(),
                    unread: true,
                    type: "system"
                });
                localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
                renderNotificationsList();
            }
            checkUserBanStatus();
            updateCommentInputState();
        })
        .subscribe();
}

function deleteSingleNotification(id, event) {
    if (event) event.stopPropagation();
    appNotifications = appNotifications.filter(n => n.id != id);
    localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
    if (!deletedNotifIds.includes(id)) { deletedNotifIds.push(id); localStorage.setItem('mg_deleted_notif_ids', JSON.stringify(deletedNotifIds)); }
    renderNotificationsList();
}

function openDeleteAllConfirmModal() {
    if (appNotifications.length === 0) { return; }
    showConfirmationSheet('حذف جميع الإشعارات', 'لا يمكن التراجع عن هذا الإجراء بعد التأكيد.', 'حذف الكل', () => {
        appNotifications.forEach(n => { if (!deletedNotifIds.includes(n.id)) deletedNotifIds.push(n.id); });
        appNotifications = []; localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
        localStorage.setItem('mg_deleted_notif_ids', JSON.stringify(deletedNotifIds));
        renderNotificationsList();
    });
}

function renderActiveMainGrid() {
    const container = document.getElementById('mainContainerView'); if (!container) return;
    if (filteredManhwaList.length === 0) { container.innerHTML = '<p class="empty-state-text">لا توجد أعمال.</p>'; return; }
    renderGridIntoContainer(filteredManhwaList, container);
}

function renderSkeletonGrid(container, count = 6) {
    let html = '<div class="manhwa-grid">';
    for (let i = 0; i < count; i++) html += `<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-title" style="width:70%"></div></div>`;
    html += '</div>';
    container.innerHTML = html;
}

function renderGridIntoContainer(items, container, forceList = false) {
    if (items.length === 0) { container.innerHTML = '<p class="empty-state-text">لا توجد نتائج.</p>'; return; }
    if (currentViewMode === 'grid' && !forceList) {
        let html = '<div class="manhwa-grid">';
        items.forEach(item => {
            const chaps = item.chapters || [];
            const rawLastNum = chaps.length ? Math.max(...chaps.map(c => parseFloat(c.num) || 0)) : 0;
            const lastChap = rawLastNum > 0 ? `الفصل ${formatChapterNum(rawLastNum)}` : 'قريباً';
            const ratingDisplay = item.rating_count > 0 ? item.rating_average.toFixed(1) : '0.0';
            const safeTitle = escapeHtml(item.title);
            
            html += `<div class="manhwa-card" onclick="openDetails('${item.id}')">
                <div class="manhwa-img-wrap"><img src="${escapeHtml(item.cover)}" loading="lazy"><div class="badges-container"><span class="card-badge">${escapeHtml(item.status || 'مستمرة')}</span>${item.isNew ? '<span class="badge-new">جديد</span>' : ''}</div></div>
                <div class="manhwa-info"><div class="manhwa-title" title="${safeTitle}">${safeTitle}</div><div class="manhwa-sub-info"><span class="manhwa-chap">${lastChap}</span><span><i class="fa-solid fa-star" style="color:#f1c40f; font-size:0.5rem;"></i> ${ratingDisplay}</span></div></div>
            </div>`;
        });
        html += '</div>'; container.innerHTML = html;
    } else {
        let html = '<div class="manhwa-list-horizontal">';
        items.forEach(item => {
            const chaps = item.chapters || [];
            const rawLastNum = chaps.length ? Math.max(...chaps.map(c => parseFloat(c.num) || 0)) : 0;
            const lastChap = rawLastNum > 0 ? `الفصل ${formatChapterNum(rawLastNum)}` : 'قريباً';
            const cats = (item.categories || []).slice(0, 4).map(c => `<span class="horiz-cat-tag">${escapeHtml(c)}</span>`).join('');
            const ratingDisplay = item.rating_count > 0 ? item.rating_average.toFixed(1) : '0.0';
            const safeTitle = escapeHtml(item.title);
            
            html += `<div class="manhwa-horizontal-card" onclick="openDetails('${item.id}')">
                <div class="horiz-img-wrap"><img src="${escapeHtml(item.cover)}" loading="lazy"><div class="badges-container"><span class="card-badge">${escapeHtml(item.status || 'مستمرة')}</span>${item.isNew ? '<span class="badge-new">جديد</span>' : ''}</div></div>
                <div class="horiz-details"><div><div class="horiz-title">${safeTitle}</div><div class="horiz-categories">${cats}</div></div><div class="horiz-meta-row"><span style="color:var(--accent); font-weight:700;">${lastChap}</span><span>${escapeHtml(item.type || 'مانهوا كورية')}</span><span><i class="fa-solid fa-star" style="color:#f1c40f;"></i> ${ratingDisplay}</span></div></div>
            </div>`;
        });
        html += '</div>'; container.innerHTML = html;
    }
}

function debouncedLiveSearch(isFinal = false) {
    if (isFinal) { clearTimeout(searchDebounceTimer); executeLiveSearch(true); return; }
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => executeLiveSearch(false), 250);
}

function executeLiveSearch(isFinalExecution = false) {
    const query = document.getElementById('liveSearchInput').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('searchResultsContainer');
    const clearBtn = document.getElementById('clearSearchTextBtn');
    if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';
    renderSearchHistoryUI();
    if (query.length === 0 && activeFilters.type === 'all' && activeFilters.status === 'all' && activeFilters.chapRange === 'all' && activeFilters.categories.length === 0) { resultsContainer.innerHTML = ''; return; }
    if (isFinalExecution && query.length > 0) saveToSearchHistory(query);
    
    let results = currentManhwaList.filter(item => {
        if (query && !(item.title || '').toLowerCase().includes(query)) return false;
        if (activeFilters.type !== 'all' && item.type !== activeFilters.type) return false;
        if (activeFilters.status !== 'all') {
            if (activeFilters.status === 'جديد') { if (!item.isNew) return false; }
            else { if (item.status !== activeFilters.status) return false; }
        }
        if (activeFilters.categories.length > 0 && !activeFilters.categories.some(cat => (item.categories || []).includes(cat))) return false;
        if (activeFilters.chapRange !== 'all') {
            const chCount = (item.chapters || []).length;
            if (activeFilters.chapRange === '1-10' && (chCount < 1 || chCount > 10)) return false;
            if (activeFilters.chapRange === '1-50' && (chCount < 1 || chCount > 50)) return false;
            if (activeFilters.chapRange === '1-100' && (chCount < 1 || chCount > 100)) return false;
            if (activeFilters.chapRange === '100+' && chCount <= 100) return false;
            if (activeFilters.chapRange === '500+' && chCount <= 500) return false;
            if (activeFilters.chapRange === '1000+' && chCount <= 1000) return false;
        }
        return true;
    });

    const sortMode = activeFilters.sort || 'popular';
    results.sort((a, b) => {
        const aViews = a.views || 0, bViews = b.views || 0;
        const aDate = new Date(a.created_at || 0).getTime(), bDate = new Date(b.created_at || 0).getTime();
        const aTitle = (a.title || '').toLowerCase(), bTitle = (b.title || '').toLowerCase();
        
        switch (sortMode) {
            case 'popular': return bViews - aViews;
            case 'latest': return bDate - aDate;
            case 'rating': return b.rating_average - a.rating_average;
            case 'alpha': return aTitle.localeCompare(bTitle, 'ar');
            default: return bViews - aViews;
        }
    });
    renderGridIntoContainer(results, resultsContainer);
}

async function loadPageContent(pageName) {
    if (!db) return;
    const titleEl = document.getElementById(pageName + 'TitleText');
    const dateEl = document.getElementById(pageName + 'DateText');
    const contentEl = document.getElementById(pageName + 'Content');
    
    if (!contentEl) return; 
    
    try {
        const { data, error } = await db.from('app_pages').select('*').eq('page_name', pageName).single();
        if (!error && data) {
            if (titleEl) titleEl.innerText = data.title;
            if (dateEl) {
                if (data.updated_at) {
                    const dateObj = new Date(data.updated_at);
                    const formattedDate = dateObj.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
                    dateEl.innerText = `آخر تحديث: ${formattedDate}`;
                } else {
                    dateEl.innerText = 'آخر تحديث: غير معروف';
                }
                dateEl.style.display = 'block';
            }
            
            let contentHtml = '';
            try {
                const parsedContent = JSON.parse(data.content);
                if (Array.isArray(parsedContent)) {
                    parsedContent.forEach(section => {
                        contentHtml += `
                            <div style="margin-bottom: 20px;">
                                <h3 style="color: var(--accent); font-size: 1.05rem; margin-bottom: 10px; font-weight: 700;">${escapeHtml(section.title)}</h3>
                                <div style="color: #d1d1e0; font-size: 0.85rem; line-height: 1.6;">${section.content}</div>
                                ${section.date ? `<div style="margin-top: 10px; font-size: 0.7rem; color: var(--text-secondary); text-align: left;">${escapeHtml(section.date)}</div>` : ''}
                            </div>
                        `;
                    });
                } else {
                    contentHtml = data.content;
                }
            } catch (e) {
                contentHtml = data.content;
            }
            
            contentEl.innerHTML = contentHtml || '<p style="text-align:center; color:var(--text-secondary);">لا يوجد محتوى.</p>';
        } else {
            if (titleEl) titleEl.innerText = 'غير متوفر';
            if (contentEl) contentEl.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">تعذر تحميل المحتوى.</p>';
        }
    } catch (err) {
        if (contentEl) contentEl.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">حدث خطأ.</p>';
    }
}

async function navigateTo(viewName) {
    if (document.getElementById('searchPageView').classList.contains('active') && viewName !== 'search') {
        resetAdvancedSearchModal();
        document.getElementById('liveSearchInput').value = '';
        document.getElementById('searchResultsContainer').innerHTML = '';
    }
    if (['privacy', 'terms', 'about', 'faq'].includes(viewName)) {
        let currentActiveView = document.querySelector('.view.active');
        if (currentActiveView && !['privacyView', 'termsView', 'aboutView', 'faqView'].includes(currentActiveView.id)) lastLegalSourceView = currentActiveView.id.replace('View', '');
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    
    if (viewName !== 'home') {
        document.getElementById('appHeaderElement').style.display = 'none';
    } else {
        document.getElementById('appHeaderElement').style.display = 'flex';
    }
    
    document.getElementById('bottomNav').style.display = 'flex';
    
    if (viewName === 'home') {
        previousSearchQueryLocation = 'home';
        document.getElementById('homeView').classList.add('active');
        document.getElementById('navHome').classList.add('active');
        if (currentManhwaList.length === 0) renderSkeletonGrid(document.getElementById('mainContainerView'), 6);
        await fetchManhwaFromDB(); renderActiveMainGrid();
    } else if (viewName === 'search') {
        document.getElementById('searchPageView').classList.add('active');
        await fetchManhwaFromDB(); renderSearchHistoryUI(); document.getElementById('liveSearchInput').focus();
    } else if (viewName === 'recommendations') {
        previousSearchQueryLocation = 'recommendations';
        document.getElementById('recommendationsView').classList.add('active');
        document.getElementById('navRecs').classList.add('active');
        
        const recContainer = document.getElementById('recommendationsView');
        recContainer.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل التوصيات...</div>';
        try {
            const { data: recData, error } = await db.from('recommendations').select('manhwa_id');
            if (!error && recData) {
                await fetchManhwaFromDB();
                const recIds = recData.map(r => r.manhwa_id);
                const recommendedItems = currentManhwaList.filter(m => recIds.includes(m.id));
                
                if (recommendedItems.length === 0) {
                    recContainer.innerHTML = '<p class="empty-state-text">لا توجد توصيات حالياً.</p>';
                } else {
                    recContainer.innerHTML = '<h3 class="section-title" style="margin-bottom: 16px;"><i class="fa-solid fa-wand-magic-sparkles"></i> مقترحة لك</h3><div id="recGridContainer"></div>';
                    renderGridIntoContainer(recommendedItems, document.getElementById('recGridContainer'), true); 
                }
            } else {
                recContainer.innerHTML = '<p class="empty-state-text">تعذر تحميل التوصيات.</p>';
            }
        } catch (err) {
            recContainer.innerHTML = '<p class="empty-state-text">حدث خطأ.</p>';
        }
    } else if (viewName === 'fav') {
        previousSearchQueryLocation = 'fav';
        document.getElementById('favView').classList.add('active');
        document.getElementById('navFav').classList.add('active');
        fetchUserLibrary();
    } else if (viewName === 'reading_history') {
        document.getElementById('readingHistoryView').classList.add('active');
        loadReadingHistoryView();
    } else if (viewName === 'my_requests') {
        document.getElementById('myRequestsView').classList.add('active');
        fetchUserRequests();
    } else if (viewName === 'history') {
        document.getElementById('historyView').classList.add('active'); renderHistoryList();
    } else if (viewName === 'downloads') {
        document.getElementById('downloadsView').classList.add('active'); renderDownloadsList();
    } else if (viewName === 'notifications') {
        document.getElementById('notificationsView').classList.add('active'); 
        await fetchUserDBNotifications(); 
        renderNotificationsList();
    } else if (viewName === 'profile') {
        previousSearchQueryLocation = 'profile';
        document.getElementById('profileView').classList.add('active');
        document.getElementById('navProfile').classList.add('active'); updateProfileUI();
    } else if (viewName === 'settings') {
        document.getElementById('settingsView').classList.add('active');
    } else if (viewName === 'privacy') {
        document.getElementById('privacyView').classList.add('active'); window.scrollTo(0,0);
        await loadPageContent('privacy');
    } else if (viewName === 'terms') {
        document.getElementById('termsView').classList.add('active'); window.scrollTo(0,0);
        await loadPageContent('terms');
    } else if (viewName === 'faq') {
        document.getElementById('faqView').classList.add('active'); window.scrollTo(0,0);
        await loadPageContent('faq');
    } else if (viewName === 'about') {
        document.getElementById('aboutView').classList.add('active'); window.scrollTo(0,0);
        await loadPageContent('about');
    }
}

function renderDownloadsList() {
    const container = document.getElementById('downloadsList'); if (!container) return;
    container.innerHTML = '';
    let hasDownloads = false;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('mg_downloaded_chapters_')) {
            const manhwaId = key.replace('mg_downloaded_chapters_', '');
            const dlMap = JSON.parse(localStorage.getItem(key));
            const manhwa = currentManhwaList.find(m => m.id === manhwaId) || JSON.parse(localStorage.getItem('mg_manhwa_meta_' + manhwaId));
            if (manhwa && Object.keys(dlMap).length > 0) {
                const count = Object.keys(dlMap).filter(k => dlMap[k] === true).length;
                if (count > 0) {
                    hasDownloads = true;
                    container.innerHTML += `<div class="manhwa-horizontal-card" onclick="openDetails('${manhwa.id}')" style="margin-bottom: 8px;">
                        <div class="horiz-img-wrap"><img src="${escapeHtml(manhwa.cover)}"></div>
                        <div class="horiz-details">
                            <div class="horiz-title">${escapeHtml(manhwa.title)}</div>
                            <div class="horiz-meta-row"><span style="color:var(--accent); font-weight:700;">${count} فصل محمل</span></div>
                        </div>
                    </div>`;
                }
            }
        }
    }
    if (!hasDownloads) container.innerHTML = '<p class="empty-state-text">لا توجد تنزيلات.</p>';
}

function goBackFromLegal() { navigateTo(lastLegalSourceView || 'home'); }

function renderGridSimple(items, elementId) {
    const grid = document.getElementById(elementId); if (!grid) return;
    grid.innerHTML = items.length === 0 ? '<p class="empty-state-text" style="grid-column:1/-1;">لا توجد أعمال.</p>' : '';
    items.forEach(item => { 
        const ratingDisplay = item.rating_count > 0 ? item.rating_average.toFixed(1) : '0.0';
        const chaps = item.chapters || [];
        const rawLastNum = chaps.length ? Math.max(...chaps.map(c => parseFloat(c.num) || 0)) : 0;
        const lastChap = rawLastNum > 0 ? `الفصل ${formatChapterNum(rawLastNum)}` : 'قريباً';
        grid.innerHTML += `<div class="manhwa-card" onclick="openDetails('${item.id}')"><div class="manhwa-img-wrap"><img src="${escapeHtml(item.cover)}" loading="lazy"><span class="card-badge" style="position:absolute; top:3px; right:3px;">${escapeHtml(item.status || 'مستمرة')}</span></div><div class="manhwa-info"><div class="manhwa-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div><div class="manhwa-sub-info"><span class="manhwa-chap">${lastChap}</span><span><i class="fa-solid fa-star" style="color:#f1c40f; font-size:0.5rem;"></i> ${ratingDisplay}</span></div></div></div>`; 
    });
}

function renderHistoryList() {
    const list = document.getElementById('historyList'); if (!list) return;
    const history = getReadingHistory();
    list.innerHTML = history.length === 0 ? '<p class="empty-state-text">السجل فارغ.</p>' : '';
    history.forEach(h => { list.innerHTML += `<div class="chapter-row-item-new" style="cursor:pointer; margin-bottom:8px;" onclick="openChapterFromList('${h.manhwaId}', ${h.chNum})"><div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;"><img src="${escapeHtml(h.cover)}" style="width:40px; height:50px; object-fit:cover; border-radius:6px;" loading="lazy"><div style="min-width:0;"><div style="font-weight:700; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(h.manhwaTitle)}</div><div style="font-size:0.7rem; color:var(--accent);">الفصل ${formatChapterNum(h.chNum)}</div></div></div><i class="fa-solid fa-chevron-left" style="color:var(--text-secondary);"></i></div>`; });
}

function renderNotificationsList() {
    const container = document.getElementById('notificationsListContainer'); if (!container) return;
    const badge = document.getElementById('notifBadge');
    const unreadCount = appNotifications.filter(n => n.unread).length;
    if (badge) { badge.innerText = unreadCount; badge.style.display = unreadCount > 0 ? 'block' : 'none'; }
    container.innerHTML = appNotifications.length === 0 ? '<p class="empty-state-text">لا توجد إشعارات.</p>' : '';
    appNotifications.forEach(n => {
        let icon = 'fa-bell';
        if (n.type === 'welcome') icon = 'fa-hand-sparkles';
        else if (n.type === 'announcement') icon = 'fa-bullhorn';
        else if (n.type === 'system') icon = 'fa-shield-halved';
        
        container.innerHTML += `<div class="notification-item ${n.unread ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}', '${n.manhwaId || ''}', ${n.chNum || null})"><div class="notification-icon"><i class="fa-solid ${icon}"></i></div><div style="flex:1; min-width:0;"><div style="font-weight:700; font-size:0.85rem; color:#fff;">${escapeHtml(n.title)}</div><div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${escapeHtml(n.desc)}</div><div style="font-size:0.65rem; color:var(--accent); margin-top:4px;">${n.time}</div></div><button class="notif-delete-btn" onclick="deleteSingleNotification('${n.id}', event)"><i class="fa-solid fa-trash-can"></i></button></div>`;
    });
}

let isHandlingNotifClick = false;
async function handleNotificationClick(notifId, manhwaId, chNum) {
    if (isHandlingNotifClick) return;
    isHandlingNotifClick = true;
    setTimeout(() => { isHandlingNotifClick = false; }, 1000); 

    const notif = appNotifications.find(n => n.id == notifId);
    if (notif) { notif.unread = false; localStorage.setItem('mg_notifications', JSON.stringify(appNotifications)); renderNotificationsList(); }
    if (!manhwaId || manhwaId === 'undefined' || manhwaId === 'null') { isHandlingNotifClick = false; return; }
    
    await fetchManhwaFromDB();
    const manhwa = currentManhwaList.find(m => m.id === manhwaId) || JSON.parse(localStorage.getItem('mg_manhwa_meta_' + manhwaId));
    if (!manhwa) { showToast("العمل لم يعد متاحاً.", "error"); isHandlingNotifClick = false; return; }
    
    if (chNum !== null && !isNaN(chNum)) {
        const chapter = (manhwa.chapters || []).find(c => c.num == chNum);
        if (chapter) openChapterFromList(manhwa.id, chNum);
        else { showToast(`الفصل ${formatChapterNum(chNum)} غير متوفر.`, "info"); openDetails(manhwaId); }
    } else openDetails(manhwaId);
    isHandlingNotifClick = false;
}

function markAllNotificationsRead() {
    appNotifications.forEach(n => n.unread = false);
    localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
    renderNotificationsList();
}

async function incrementViewCount(manhwaId) {
    const key = 'mg_viewed_' + manhwaId;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'true');
    if (!db) return;
    try {
        await db.rpc('increment_manhwa_views', { p_manhwa_id: manhwaId });
        const item = currentManhwaList.find(m => m.id === manhwaId);
        if (item) item.views = (item.views || 0) + 1;
    } catch (err) { console.error(err); }
}

function updateCommentsPageTitle(manhwaId, chNum = null) {
    const manhwa = currentManhwaList.find(m => m.id === manhwaId) || JSON.parse(localStorage.getItem('mg_manhwa_meta_' + manhwaId));
    if (!manhwa) return;
    document.getElementById('commentsPageTitleSpan').innerText = manhwa.title || 'التعليقات';
    document.getElementById('commentsPageSubtitleSpan').innerText = chNum !== null ? `تعليقات الفصل ${formatChapterNum(chNum)}` : 'تعليقات العمل';
}

async function openCommentsPageForWork(manhwaId) {
    currentCommentContextType = 'work'; currentCommentTargetChapterNum = null; currentOpenManhwaId = manhwaId;
    await fetchManhwaFromDB();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('commentsPageView').classList.add('active');
    document.getElementById('appHeaderElement').style.display = 'none'; document.getElementById('bottomNav').style.display = 'none';
    cancelReplyingMode();
    updateCommentsPageTitle(manhwaId, null);
    await fetchIndependentComments(manhwaId, null);
    updateCommentInputState(); 
    window.scrollTo(0, 0);
}

async function openCommentsPageForChapter(manhwaId, chNum) {
    currentCommentContextType = 'chapter'; currentCommentTargetChapterNum = chNum; currentOpenManhwaId = manhwaId;
    await fetchManhwaFromDB();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('commentsPageView').classList.add('active');
    document.getElementById('appHeaderElement').style.display = 'none'; document.getElementById('bottomNav').style.display = 'none';
    cancelReplyingMode();
    updateCommentsPageTitle(manhwaId, chNum);
    await fetchIndependentComments(manhwaId, chNum);
    updateCommentInputState(); 
    window.scrollTo(0, 0);
}

async function fetchIndependentComments(manhwaId, chNum = null) {
    const container = document.getElementById('independentCommentsList'); if (!container) return;
    if (!db) { container.innerHTML = '<p class="empty-state-text">لا توجد تعليقات.</p>'; return; }
    try {
        let query = db.from('comments').select('*').eq('manhwa_id', manhwaId).eq('is_deleted', false);
        if (chNum !== null) query = query.eq('chapter_num', chNum);
        else query = query.is('chapter_num', null);
        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            container.innerHTML = '<p class="empty-state-text">لا توجد تعليقات بعد. كن أول من يعلق!</p>';
            currentWorkComments = []; return;
        }
        let userLikes = [];
        if (currentUser) {
            const { data: likesData } = await db.from('comment_likes').select('comment_id').eq('user_id', currentUser.id);
            if (likesData) userLikes = likesData.map(l => l.comment_id);
        }
        currentWorkComments = data.map(c => ({ ...c, is_liked: userLikes.includes(c.id) }));
        sortAndRenderIndependentComments();
    } catch (err) {
        container.innerHTML = '<p class="empty-state-text">تعذر تحميل التعليقات.</p>';
    }
}

function sortAndRenderIndependentComments() {
    let list = [...currentWorkComments];
    if (currentCommentsSortOrder === 'latest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (currentCommentsSortOrder === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else list.sort((a, b) => { const d = (b.likes || 0) - (a.likes || 0); return d !== 0 ? d : new Date(b.created_at) - new Date(a.created_at); });
    renderIndependentCommentsUI(list);
}

function renderIndependentCommentsUI(commentsList) {
    const container = document.getElementById('independentCommentsList');
    if (!container) return;
    if (commentsList.length === 0) {
        container.innerHTML = '<p class="empty-state-text">لا توجد تعليقات بعد. كن أول من يعلق!</p>';
        return;
    }
    const userId = currentUser ? currentUser.id : localStorage.getItem('mg_user_identifier');
    container.innerHTML = '';
    window._commentTexts = window._commentTexts || {};

    commentsList.forEach(comm => {
        window._commentTexts[comm.id] = comm.text || comm.comment || '';
        const rawText = comm.text || comm.comment || '';
        const mentionMatch = rawText.match(/^@(\S+)\s+([\s\S]*)$/);
        const safeText = mentionMatch
            ? `<span class="mention">@${escapeHtml(mentionMatch[1])}</span> ${escapeHtml(mentionMatch[2])}`
            : escapeHtml(rawText);
            
        let displaySafeText = safeText;
        if (comm.is_spoiler) {
            displaySafeText = `<span class="spoiler-text" onclick="this.classList.add('revealed')" title="اضغط لكشف الحرق">${safeText}</span>`;
        }

        const userName = escapeHtml(comm.username || 'قارئ');
        const isMyComment = comm.user_id === userId;
        const isReply = !!comm.reply_to_id;
        const likesCount = comm.likes || 0;
        const isLiked = comm.is_liked || false;
        const avatarHtml = comm.user_avatar ? `<img src="${escapeHtml(comm.user_avatar)}" alt="">` : `<i class="fa-solid fa-user"></i>`;

        const reportBtn = !isMyComment ? `<button class="comment-action-btn comment-report-trigger" data-report-id="${comm.id}" title="إبلاغ"><i class="fa-solid fa-flag"></i></button>` : '';

        const div = document.createElement('div');
        div.className = `comment-item ${isReply ? 'is-reply' : ''}`;
        div.id = `commBox_${comm.id}`;
        div.innerHTML = `
            <div class="comment-avatar">${avatarHtml}</div>
            <div class="comment-body">
                <div class="comment-header-row">
                    <span class="comment-username">${userName}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="comment-time">${formatRelativeArabicTime(comm.created_at)}</span>
                        <button class="comment-action-btn comment-options-trigger" data-comment-id="${comm.id}" data-ismine="${isMyComment}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                </div>
                <div class="comment-text" id="commText_${comm.id}">${displaySafeText}</div>
                <div class="comment-footer-actions">
                    <button class="comment-action-btn ${isLiked ? 'active' : ''}" data-like-id="${comm.id}"><i class="fa-solid fa-heart"></i> <span id="indepLike_${comm.id}">${likesCount}</span></button>
                    <button class="comment-action-btn comment-reply-trigger" data-reply-id="${comm.id}" data-reply-user="${userName}"><i class="fa-solid fa-reply"></i> رد</button>
                    ${reportBtn}
                </div>
            </div>`;
        container.appendChild(div);
    });

    container.querySelectorAll('.comment-options-trigger').forEach(btn => {
        btn.addEventListener('click', () => openCommentOptionsModal(btn.getAttribute('data-comment-id'), btn.getAttribute('data-ismine') === 'true'));
    });
    container.querySelectorAll('.comment-reply-trigger').forEach(btn => {
        btn.addEventListener('click', () => prepareIndepReply(btn.getAttribute('data-reply-id'), btn.getAttribute('data-reply-user')));
    });
    container.querySelectorAll('[data-like-id]').forEach(btn => {
        btn.addEventListener('click', () => toggleIndepCommentLike(btn.getAttribute('data-like-id')));
    });
    container.querySelectorAll('.comment-report-trigger').forEach(btn => {
        btn.addEventListener('click', () => openReportModal(btn.getAttribute('data-report-id')));
    });
}

async function toggleIndepCommentLike(commentId) {
    if (!checkGuestPermission('comments')) return;
    try {
        const { data, error } = await db.rpc('toggle_comment_like', { p_comment_id: commentId });
        if (error) throw error;
        let comm = currentWorkComments.find(c => c.id == commentId);
        if (comm) { comm.likes = data.count; comm.is_liked = data.liked; sortAndRenderIndependentComments(); }
    } catch (err) { showToast("خطأ في الإعجاب", "error"); }
}

function prepareIndepReply(commentId, username) {
    if (!checkGuestPermission('comments')) return;
    if (isUserBanned) { showToast("لا يمكنك الرد لأنك محظور.", "error"); return; }
    currentReplyingToCommentId = commentId; currentReplyingToUsername = username;
    if (editingCommentId) {
        editingCommentId = null;
        document.getElementById('indepSendCommentBtn').innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
    }
    const row = document.getElementById('replyingIndicatorRow');
    document.getElementById('replyingToText').innerText = `الرد على @${username}`;
    row.style.display = 'flex';
    document.getElementById('indepCommentInput').focus();
}

function cancelReplyingMode() {
    currentReplyingToCommentId = null; currentReplyingToUsername = null; editingCommentId = null;
    document.getElementById('replyingIndicatorRow').style.display = 'none';
    document.getElementById('indepSendCommentBtn').innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
    isSpoilerActive = false;
    const spoilerBtn = document.getElementById('spoilerToggleBtn');
    if(spoilerBtn) spoilerBtn.classList.remove('active-spoiler');
}

function openCommentOptionsModal(commentId, isMyComment) {
    const overlay = document.getElementById('optionsModalOverlay');
    const box = document.getElementById('optionsModalContentBox');
    if (!overlay || !box) return;
    const commentText = (window._commentTexts && window._commentTexts[commentId]) || '';
    box.innerHTML = '';
    if (isMyComment) {
        box.innerHTML = `<button class="option-item-btn" id="optEdit"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
            <button class="option-item-btn danger" id="optDelete"><i class="fa-solid fa-trash-can"></i> حذف</button>
            <button class="option-item-btn" id="optCopy"><i class="fa-solid fa-copy"></i> نسخ النص</button>
            <button class="btn-reset" onclick="closeOptionsModal()" style="width:100%;">إلغاء</button>`;
        document.getElementById('optEdit').onclick = () => startEditingComment(commentId);
        document.getElementById('optDelete').onclick = () => deleteMyComment(commentId);
        document.getElementById('optCopy').onclick = () => copyCommentText(commentText);
    } else {
        box.innerHTML = `<button class="option-item-btn" id="optCopy"><i class="fa-solid fa-copy"></i> نسخ النص</button>
            <button class="option-item-btn danger" id="optReport"><i class="fa-solid fa-flag"></i> الإبلاغ عن التعليق</button>
            <button class="btn-reset" onclick="closeOptionsModal()" style="width:100%;">إلغاء</button>`;
        document.getElementById('optCopy').onclick = () => copyCommentText(commentText);
        document.getElementById('optReport').onclick = () => openReportModal(commentId);
    }
    overlay.style.display = 'flex';
}
function closeOptionsModal() { document.getElementById('optionsModalOverlay').style.display = 'none'; }

function copyCommentText(text) {
    copyTextNative(text).then(() => { closeOptionsModal(); });
}

function startEditingComment(commentId) {
    if (isUserBanned) { showToast("لا يمكنك التعديل لأنك محظور.", "error"); return; }
    closeOptionsModal();
    const input = document.getElementById('indepCommentInput');
    const commentText = (window._commentTexts && window._commentTexts[commentId]) || '';
    if (!input) return;
    editingCommentId = commentId;
    input.value = commentText;
    input.focus();
    document.getElementById('indepSendCommentBtn').innerHTML = `<i class="fa-solid fa-check"></i>`;
    document.getElementById('replyingIndicatorRow').style.display = 'none';
}

async function deleteMyComment(commentId) {
    closeOptionsModal();
    showConfirmationSheet('حذف التعليق', 'هل أنت متأكد من رغبتك في حذف هذا التعليق؟', 'حذف', async () => {
        currentWorkComments = currentWorkComments.filter(c => c.id != commentId);
        sortAndRenderIndependentComments();
        if (db) { try { await db.from('comments').update({ is_deleted: true }).eq('id', commentId); } catch (e) { console.error(e); } }
    });
}

function openReportModal(commentId) {
    closeOptionsModal();
    activeReportingCommentId = commentId;
    document.getElementById('reportModalOverlay').style.display = 'flex';
}

async function submitReportReason(reason) {
    document.getElementById('reportModalOverlay').style.display = 'none';
    const userId = currentUser ? currentUser.id : localStorage.getItem('mg_user_identifier');
    if (!userId) { showToast("يجب تسجيل الدخول.", "error"); return; }
    if (db) { try { await db.from('comment_reports').insert([{ comment_id: activeReportingCommentId, reporter_user_id: userId, reason: reason }]); } catch (e) { console.error(e); } }
    activeReportingCommentId = null;
}

async function submitWorkReportReason(reason) {
    document.getElementById('reportWorkModalOverlay').style.display = 'none';
    const userId = currentUser ? currentUser.id : localStorage.getItem('mg_user_identifier');
    if (!userId) { showToast("يجب تسجيل الدخول.", "error"); return; }
    if (db) { try { await db.from('work_reports').insert([{ manhwa_id: currentOpenManhwaId, reporter_user_id: userId, reason: reason }]); } catch (e) { console.error(e); } }
    showToast("تم إرسال البلاغ. شكراً لك.", "success");
}

async function sendIndependentComment() {
    if (!checkGuestPermission('comments')) return;
    if (isUserBanned) { showToast("لقد تم حظرك من التعليق بسبب مخالفة القواعد.", "error", 5000); return; }
    
    const input = document.getElementById('indepCommentInput'); if (!input) return;
    let text = input.value.trim();
    if (!text) { showToast("اكتب شيئاً أولاً.", "error"); return; }

    if (editingCommentId) {
        const editId = editingCommentId;
        editingCommentId = null;
        document.getElementById('indepSendCommentBtn').innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
        let comm = currentWorkComments.find(c => c.id == editId);
        if (comm) {
            comm.text = text;
            if (db) { try { await db.from('comments').update({ text: text }).eq('id', editId); } catch (e) { console.error(e); } }
        }
        input.value = '';
        sortAndRenderIndependentComments();
        return;
    }

    if (!currentOpenManhwaId) return;
    const userId = currentUser?.id;
    if (!userId) { showToast("سجّل الدخول أولاً.", "error"); return; }
    const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
    const userAvatar = currentUser.user_metadata?.avatar_url || null; 
    
    if (currentReplyingToCommentId && currentReplyingToUsername && !text.startsWith('@')) {
        text = `@${currentReplyingToUsername} ${text}`;
    }
    
    const newObj = { 
        manhwa_id: currentOpenManhwaId, 
        chapter_num: currentCommentContextType === 'chapter' ? currentCommentTargetChapterNum : null, 
        reply_to_id: currentReplyingToCommentId || null, 
        user_id: userId, 
        username: username, 
        user_avatar: userAvatar, 
        text: text, 
        likes: 0, 
        is_spoiler: isSpoilerActive,
        created_at: new Date().toISOString() 
    };

    if (db) {
        try {
            const { data, error } = await db.from('comments').insert([newObj]).select();
            if (!error && data) { 
                currentWorkComments.unshift(data[0]); 
                input.value = ''; 
                cancelReplyingMode(); 
                sortAndRenderIndependentComments(); 
            }
            else showToast("تعذر النشر.", "error");
        } catch (err) { console.error(err); }
    }
}

function updateDetailsRatingUI(item) {
    const ratingValEl = document.getElementById('ratingValue');
    const ratingCountEl = document.getElementById('ratingCountLabel');
    
    if (item.rating_count > 0) {
        ratingValEl.innerText = item.rating_average.toFixed(1);
        ratingCountEl.innerText = `(${item.rating_count} تقييم)`;
    } else {
        ratingValEl.innerText = "0.0";
        ratingCountEl.innerText = "لا توجد تقييمات";
    }
}

async function openDetails(id) {
    let item = await fetchSingleManhwa(id);
    if (!item) {
        item = JSON.parse(localStorage.getItem('mg_manhwa_meta_' + id));
    }
    if (!item) { showToast("تعذر تحميل بيانات العمل. تأكد من اتصالك بالإنترنت.", "error"); return; }
    
    currentOpenManhwaId = id; 
    if (navigator.onLine) await incrementViewCount(id);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('detailsView').classList.add('active');
    document.getElementById('appHeaderElement').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'flex';

    document.getElementById('tabDetailsBtn').classList.add('active');
    document.getElementById('tabChaptersBtn').classList.remove('active');
    document.getElementById('tabDetailsContent').style.display = 'block';
    document.getElementById('tabChaptersContent').style.display = 'none';

    const titleEl = document.getElementById('workTitleText');
    titleEl.innerText = item.title || '';
    titleEl.onclick = () => { document.getElementById('fullTitleModalText').innerText = item.title; document.getElementById('titleModalOverlay').style.display = 'flex'; };

    document.getElementById('workAuthorText').innerText = item.author || 'غير معلوم';
    document.getElementById('workCoverImg').src = item.cover;
    document.getElementById('workBannerImg').src = item.cover;
    document.getElementById('workDescription').innerText = item.description || 'لا يوجد وصف.';
    document.getElementById('storyStatusText').innerText = item.status || 'مستمرة';
    document.getElementById('workTypeText').innerText = item.type || 'مانهوا كورية';
    document.getElementById('viewsCount').innerText = item.views || 0;

    const ageBadgeContainer = document.getElementById('ageRatingBadgeContainer');
    const warningContainer = document.getElementById('contentWarningContainer');
    
    if (item.age_rating) { 
        ageBadgeContainer.style.display = 'inline-flex'; 
        ageBadgeContainer.innerHTML = `<span class="age-rating-badge-pro"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(item.age_rating)}</span>`; 
    }
    else { ageBadgeContainer.style.display = 'none'; ageBadgeContainer.innerHTML = ''; }
    
    const isAgeRestricted = item.age_rating && (String(item.age_rating).includes('18') || String(item.age_rating).includes('16'));
    
    if (item.has_content_warning === true || isAgeRestricted) { 
        warningContainer.style.display = 'block'; 
        warningContainer.innerHTML = `<div class="content-warning-box-pro"><i class="fa-solid fa-triangle-exclamation"></i><span><strong>تنبيه:</strong> هذا العمل يحتوي على مشاهد عنف أو دماء أو محتوى غير مناسب للقاصرين. يُرجى مراعاة التصنيف العمري.</span></div>`; 
    }
    else { warningContainer.style.display = 'none'; warningContainer.innerHTML = ''; }

    updateDetailsRatingUI(item);

    updateLibraryButtonState(item.id);
    const catRow = document.getElementById('categoriesRow');
    catRow.innerHTML = '';
    (item.categories || ["أكشن", "فانتازيا"]).forEach(cat => { catRow.innerHTML += `<span class="cat-badge-new">${escapeHtml(cat)}</span>`; });

    const chaps = item.chapters || [];
    document.getElementById('totalChaptersCount').innerText = chaps.length;
    const rawLastNum = chaps.length ? Math.max(...chaps.map(c => parseFloat(c.num) || 0)) : 0;
    document.getElementById('lastChapterNum').innerText = formatChapterNum(rawLastNum);

    initChaptersSection(item);
    document.getElementById('btnOpenCommentsPage').onclick = () => openCommentsPageForWork(item.id);
    document.getElementById('btnReportWork').onclick = () => { document.getElementById('reportWorkModalOverlay').style.display = 'flex'; };
    window.scrollTo(0, 0);
}

function initChaptersSection(manhwaItem) {
    const manhwaId = manhwaItem.id, chaps = manhwaItem.chapters || [];
    const savedSort = localStorage.getItem('mg_chapter_sort_' + manhwaId);
    chapterSortOrder = savedSort || 'latest';
    renderContinueReadingWidget(manhwaItem);
    updateChaptersStatsBar(manhwaItem);

    const searchInput = document.getElementById('chapterSearchInputFlex');
    const clearSearchBtn = document.getElementById('clearChapSearchBtn');
    searchInput.value = ''; clearSearchBtn.style.display = 'none';
    searchInput.oninput = (e) => { const q = e.target.value.trim(); clearSearchBtn.style.display = q.length > 0 ? 'block' : 'none'; renderFilteredAndSortedChapters(manhwaItem, q); };
    clearSearchBtn.onclick = () => { searchInput.value = ''; clearSearchBtn.style.display = 'none'; renderFilteredAndSortedChapters(manhwaItem, ''); searchInput.focus(); };

    const sortBtn = document.getElementById('sortDropdownBtn'), sortMenu = document.getElementById('sortMenuPopup');
    sortMenu.style.display = 'none';
    sortBtn.onclick = (e) => { e.stopPropagation(); sortMenu.style.display = sortMenu.style.display === 'flex' ? 'none' : 'flex'; };

    document.querySelectorAll('#sortMenuPopup .sort-menu-item').forEach(itemEl => {
        itemEl.onclick = () => {
            document.querySelectorAll('#sortMenuPopup .sort-menu-item').forEach(i => i.classList.remove('active'));
            itemEl.classList.add('active');
            chapterSortOrder = itemEl.getAttribute('data-sort');
            sortMenu.style.display = 'none';
            localStorage.setItem('mg_chapter_sort_' + manhwaId, chapterSortOrder);
            renderFilteredAndSortedChapters(manhwaItem, searchInput.value.trim());
        };
    });
    if (savedSort) {
        document.querySelectorAll('#sortMenuPopup .sort-menu-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-sort') === chapterSortOrder));
    }

    const dlAllBtn = document.getElementById('downloadAllChaptersBtn');
    const confirmOverlay = document.getElementById('downloadConfirmOverlay');
    const confirmBtn = document.getElementById('confirmDownloadAllBtn');
    const cancelBtn = document.getElementById('cancelDownloadAllBtn');
    const confirmText = document.getElementById('downloadConfirmText');

    dlAllBtn.onclick = () => {
        if (!checkGuestPermission('download')) return;
        let dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaId)) || {};
        const unDl = chaps.filter(c => !dlMap[c.num]);
        if (unDl.length === 0) { showToast("جميع الفصول منزّلة.", "info"); return; }
        confirmText.innerText = `هل تريد تنزيل ${chaps.length} فصل؟`;
        confirmOverlay.style.display = 'flex';
    };
    cancelBtn.onclick = () => { confirmOverlay.style.display = 'none'; };
    confirmBtn.onclick = async () => { confirmOverlay.style.display = 'none'; await downloadAllChaptersForWork(manhwaItem); };

    document.getElementById('manageDownloadsBtn').onclick = () => manageDownloadsForManhwa(manhwaId);

    renderFilteredAndSortedChapters(manhwaItem, '');
}

function updateChaptersStatsBar(manhwaItem) {
    const totalCount = (manhwaItem.chapters || []).length;
    const readDataMap = getReadChapters();
    const uniqueReadList = readDataMap[manhwaItem.id] || [];
    const actualChapterNums = new Set((manhwaItem.chapters || []).map(c => String(parseFloat(c.num))));
    const validReadList = uniqueReadList.filter(num => actualChapterNums.has(String(parseFloat(num))));
    document.getElementById('chapCountStatsText').innerText = `إجمالي الفصول: ${totalCount}`;
    document.getElementById('chapReadStatsText').innerText = `المكتملة: ${Math.min(validReadList.length, totalCount)}`;
}

function renderContinueReadingWidget(manhwaItem) {
    const container = document.getElementById('continueReadingContainer'); if (!container) return;
    const chaps = manhwaItem.chapters || [];
    if (chaps.length === 0) { container.style.display = 'none'; return; }
    const readData = getReadChapters()[manhwaItem.id] || [];
    const lastReadMap = JSON.parse(localStorage.getItem('mg_last_read')) || {};
    const lastReadNum = lastReadMap[manhwaItem.id];
    
    let targetCh = null;
    if (lastReadNum !== undefined) {
        targetCh = chaps.find(c => Number(c.num) === Number(lastReadNum));
    }
    if (!targetCh) {
        const sortedChaps = [...chaps].sort((a,b) => parseFloat(a.num) - parseFloat(b.num));
        targetCh = sortedChaps.find(c => !readData.includes(parseFloat(c.num))) || sortedChaps[0];
    }
    
    if (!targetCh) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    container.innerHTML = `<div class="continue-reading-card" onclick="openChapterFromList('${manhwaItem.id}', ${targetCh.num})"><div class="continue-info"><h4>مواصلة القراءة</h4><p>الفصل ${formatChapterNum(targetCh.num)}</p></div><div class="continue-icon-wrap"><i class="fa-solid fa-play"></i></div></div>`;
}


// ═══════════════════════════════════════════════════════════
// Reader & Download Logic (Filesystem Native)
// ═══════════════════════════════════════════════════════════

async function saveImagesToFilesystem(manhwaId, chNum, urls) {
    if (!window.Capacitor || !window.Capacitor.Plugins.Filesystem) {
        showToast("مكتبة التخزين غير متوفرة.", "error");
        return false;
    }
    const { Filesystem } = window.Capacitor.Plugins;
    const path = `manhwa_${manhwaId}/chapter_${chNum}`;

    try {
        try { 
            await Filesystem.mkdir({ 
                path, 
                directory: 'DATA', 
                recursive: true 
            }); 
        } catch(e) {}

        for (let i = 0; i < urls.length; i++) {
            const res = await fetch(urls[i]);
            if (!res.ok) throw new Error(`فشل تحميل الصورة ${i}`);
            const blob = await res.blob();
            
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
            
            await Filesystem.writeFile({
                path: `${path}/page_${i}.jpg`,
                data: base64,
                directory: 'DATA',
                encoding: 'base64'
            });
        }
        return true;
    } catch (error) {
        console.error("Error saving images to filesystem:", error);
        showToast("تفاصيل الخطأ: " + (error.message || error), "error", 5000);
        return false;
    }
}

async function getImagesFromFilesystem(manhwaId, chNum) {
    if (!window.Capacitor || !window.Capacitor.Plugins.Filesystem) return null;
    const { Filesystem } = window.Capacitor.Plugins;
    const path = `manhwa_${manhwaId}/chapter_${chNum}`;

    try {
        const result = await Filesystem.readdir({ 
            path, 
            directory: 'DATA' 
        });
        
        const files = result.files
            .filter(f => f.name.endsWith('.jpg'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        
        if (files.length === 0) return null;
        
        const urls = [];
        for (const f of files) {
            const fileUri = await Filesystem.getUri({ path: `${path}/${f.name}`, directory: 'DATA' });
            urls.push(window.Capacitor.convertFileSrc(fileUri.uri));
        }
        return urls;
    } catch (error) {
        return null; 
    }
}

async function deleteImagesFromFilesystem(manhwaId, chNum) {
    if (!window.Capacitor || !window.Capacitor.Plugins.Filesystem) return;
    const { Filesystem } = window.Capacitor.Plugins;
    const path = `manhwa_${manhwaId}/chapter_${chNum}`;
    try {
        await Filesystem.rmdir({ path, directory: 'DATA', recursive: true });
    } catch (e) {}
}

async function deleteAllImagesForManhwa(manhwaId) {
    if (!window.Capacitor || !window.Capacitor.Plugins.Filesystem) return;
    const { Filesystem } = window.Capacitor.Plugins;
    const path = `manhwa_${manhwaId}`;
    try {
        await Filesystem.rmdir({ path, directory: 'DATA', recursive: true });
    } catch (e) {}
}

async function fetchChapterPages(manhwaId, chNum) {
    if (!db) return [];
    try {
        const { data, error } = await db.from('chapters').select('pages').eq('manhwa_id', manhwaId).eq('num', chNum).single();
        if (error) throw error;
        return data?.pages || [];
    } catch (err) {
        console.error("Error fetching pages:", err);
        return [];
    }
}

function showReaderLoadingState(manhwaId, chapterNum, title) {
    pdfReaderState.manhwaId = manhwaId;
    pdfReaderState.chapterNum = chapterNum;
    pdfReaderState.pages = [];
    
    document.getElementById('pdfHudManhwaTitle').innerText = title;
    document.getElementById('pdfHudChapterTitle').innerText = `الفصل ${formatChapterNum(chapterNum)}`;
    document.getElementById('totalPdfPageNum').innerText = '...';
    
    document.getElementById('pdfPagesContainer').innerHTML = `
        <div class="reader-loading-indicator">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>جاري تحميل الفصل...</span>
        </div>
    `;
    
    applyReaderModeStyles();
    document.getElementById('readerView').classList.add('active');
    document.getElementById('appHeaderElement').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
}

function hideReaderAndShowError() {
    readerOpenGeneration++;
    document.getElementById('readerView').classList.remove('active');
    document.getElementById('appHeaderElement').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    document.getElementById('pdfPagesContainer').innerHTML = '';
    pdfReaderState.manhwaId = null;
    pdfReaderState.chapterNum = null;
    pdfReaderState.pages = [];
    showToast("تعذر تحميل صفحات الفصل.", "error");
}

async function openChapterFromList(manhwaId, chNum) {
    let manhwa = currentManhwaList.find(m => m.id === manhwaId);
    if (!manhwa) {
        manhwa = JSON.parse(localStorage.getItem('mg_manhwa_meta_' + manhwaId));
    }
    if (!manhwa) { showToast("بيانات العمل غير متوفرة.", "error"); return; }
    
    const chapter = (manhwa.chapters || []).find(c => Number(c.num) === Number(chNum)) || { id: 'local', num: chNum }; 
    
    let pages = [];
    let isLocal = false;

    const dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaId)) || {};
    if (dlMap[chNum] === true) {
        const localPages = await getImagesFromFilesystem(manhwaId, chNum);
        if (localPages && localPages.length > 0) {
            pages = localPages;
            isLocal = true;
        }
    }

    if (isLocal) {
        openPdfReader(manhwa.id, manhwa.title, Number(chNum), pages, chapter.id);
    } else {
        if (!navigator.onLine) {
            showToast("هذا الفصل غير محمل. يرجى الاتصال بالإنترنت.", "error");
            return;
        }
        const myGen = ++readerOpenGeneration;
        showReaderLoadingState(manhwa.id, Number(chNum), manhwa.title);
        
        const fetchedPages = await fetchChapterPages(manhwaId, chNum);
        
        if (myGen !== readerOpenGeneration) return;
        
        if (!fetchedPages || fetchedPages.length === 0) {
            hideReaderAndShowError();
            return;
        }
        
        openPdfReader(manhwa.id, manhwa.title, Number(chNum), fetchedPages, chapter.id);
    }
}

function renderFilteredAndSortedChapters(manhwaItem, searchQuery) {
    const listInner = document.getElementById('chaptersListInner'); if (!listInner) return;
    let chaps = [...(manhwaItem.chapters || [])];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        chaps = chaps.filter(c => {
            const numStr = String(c.num), formatted = formatChapterNum(c.num);
            return numStr.includes(q) || formatted.includes(q) || (c.title || '').toLowerCase().includes(q);
        });
    }
    chaps.sort((a, b) => {
        const nA = parseFloat(a.num) || 0, nB = parseFloat(b.num) || 0;
        return chapterSortOrder === 'latest' ? nB - nA : nA - nB;
    });
    if (chaps.length === 0) { listInner.innerHTML = '<p class="empty-state-text" style="min-height: 200px;">لا توجد فصول مطابقة.</p>'; return; }
    const readData = getReadChapters()[manhwaItem.id] || [];
    const dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaItem.id)) || {};
    listInner.innerHTML = '';
    chaps.forEach(ch => {
        const isRead = readData.includes(parseFloat(ch.num));
        const isDownloaded = dlMap[ch.num] === true;
        const publishTime = formatRelativeArabicTime(ch.created_at || manhwaItem.created_at);
        const row = document.createElement('div'); row.className = 'chapter-row-item-new';
        row.innerHTML = `
            <div class="chapter-item-main-info" onclick="openChapterFromList('${manhwaItem.id}', ${ch.num})">
                <div class="chapter-read-status-icon">${isRead ? '<i class="fa-solid fa-circle-check" title="مقروء"></i>' : '<i class="fa-solid fa-eye" title="غير مقروء"></i>'}</div>
                <div class="chapter-text-details">
                    <span class="chapter-main-title-text">الفصل ${formatChapterNum(ch.num)} ${ch.title ? '- ' + escapeHtml(ch.title) : ''}</span>
                    <span class="chapter-publish-time-text">${publishTime}</span>
                </div>
            </div>
            <div class="chapter-row-actions">
                <button class="chapter-action-icon-btn ${isDownloaded ? 'downloaded-ok' : ''}" id="dlBtn_${manhwaItem.id}_${ch.num}" onclick="handleSingleChapterDownload('${manhwaItem.id}', ${ch.num}, event)" title="${isDownloaded ? 'منزّل' : 'تنزيل'}">
                    ${isDownloaded ? '<i class="fa-solid fa-circle-down"></i>' : '<i class="fa-solid fa-download"></i>'}
                </button>
                <button class="chapter-action-icon-btn" onclick="openCommentsPageForChapter('${manhwaItem.id}', ${ch.num})" title="تعليقات الفصل"><i class="fa-regular fa-comment-dots"></i></button>
            </div>`;
        listInner.appendChild(row);
    });
}

async function handleSingleChapterDownload(manhwaId, chNum, event) {
    if (event) event.stopPropagation();
    if (!checkGuestPermission('download')) return;
    const manhwa = currentManhwaList.find(m => m.id === manhwaId); if (!manhwa) return;
    
    let dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaId)) || {};
    if (dlMap[chNum] === true) { showToast(`الفصل ${formatChapterNum(chNum)} منزّل مسبقاً.`, "info"); return; }
    
    const btn = document.getElementById(`dlBtn_${manhwaId}_${chNum}`);
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; btn.disabled = true; }
    
    try {
        const pages = await fetchChapterPages(manhwaId, chNum);
        if (!pages || pages.length === 0) {
            throw new Error("الصفحات غير متوفرة");
        }
        
        const saved = await saveImagesToFilesystem(manhwaId, chNum, pages);
        if (!saved) {
            throw new Error("فشل حفظ الصور في ذاكرة الهاتف.");
        }

        dlMap[chNum] = true;
        localStorage.setItem('mg_downloaded_chapters_' + manhwaId, JSON.stringify(dlMap));
        localStorage.setItem('mg_manhwa_meta_' + manhwaId, JSON.stringify(manhwa));
        
        if (btn) { btn.className = "chapter-action-icon-btn downloaded-ok"; btn.innerHTML = `<i class="fa-solid fa-circle-down"></i>`; btn.disabled = false; }
    } catch (err) {
        showToast(err.message || 'فشل التنزيل.', "error");
        if (btn) { btn.innerHTML = `<i class="fa-solid fa-download"></i>`; btn.disabled = false; }
    }
}

async function downloadAllChaptersForWork(manhwaItem) {
    if (!checkGuestPermission('download')) return;
    const chaps = manhwaItem.chapters || [];
    let dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaItem.id)) || {};
    localStorage.setItem('mg_manhwa_meta_' + manhwaItem.id, JSON.stringify(manhwaItem));

    const toDownload = chaps.filter(ch => !dlMap[ch.num]);
    
    if (toDownload.length === 0) { showToast('جميع الفصول متوفرة.', 'info'); return; }

    const overlay = document.getElementById('downloadProgressOverlay');
    const bar = document.getElementById('downloadProgressBar');
    const text = document.getElementById('downloadProgressText');
    const percent = document.getElementById('downloadProgressPercent');
    overlay.style.display = 'flex';
    bar.style.width = '0%'; percent.innerText = '0%';
    text.innerText = `جاري تجهيز 0 من ${toDownload.length}...`;
    let completed = 0;
    const BATCH = 3;

    try {
        for (let i = 0; i < toDownload.length; i += BATCH) {
            const batch = toDownload.slice(i, i + BATCH);
            
            for (const ch of batch) {
                const pages = await fetchChapterPages(manhwaItem.id, ch.num);
                if (pages && pages.length > 0) {
                    const saved = await saveImagesToFilesystem(manhwaItem.id, ch.num, pages);
                    if (saved) dlMap[ch.num] = true;
                }
                completed++;
                const pct = Math.round((completed / toDownload.length) * 100);
                bar.style.width = pct + '%'; percent.innerText = pct + '%';
                text.innerText = `جاري تجهيز ${completed} من ${toDownload.length}...`;
                
                localStorage.setItem('mg_downloaded_chapters_' + manhwaItem.id, JSON.stringify(dlMap));
            }
            await new Promise(r => setTimeout(r, 15));
        }
        overlay.style.display = 'none';
        showToast(`تم تجهيز ${toDownload.length} فصل!`, 'success');
        renderFilteredAndSortedChapters(manhwaItem, document.getElementById('chapterSearchInputFlex').value.trim());
    } catch (e) {
        overlay.style.display = 'none';
        showToast(e.message || 'خطأ في التنزيل.', 'error', 5000);
        renderFilteredAndSortedChapters(manhwaItem, document.getElementById('chapterSearchInputFlex').value.trim());
    }
}

async function manageDownloadsForManhwa(manhwaId) {
    const dlMap = JSON.parse(localStorage.getItem('mg_downloaded_chapters_' + manhwaId)) || {};
    const count = Object.keys(dlMap).filter(k => dlMap[k] === true).length;
    if (count === 0) { showToast('لا توجد فصول محفوظة.', 'info'); return; }
    
    showConfirmationSheet('إدارة التنزيلات', `هل تريد حذف ${count} فصل محفوظ؟`, 'حذف الكل', async () => {
        try {
            localStorage.removeItem('mg_downloaded_chapters_' + manhwaId);
            await deleteAllImagesForManhwa(manhwaId);
            
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(`mg_reader_pos_${manhwaId}_`)) keys.push(k);
            }
            keys.forEach(k => localStorage.removeItem(k));
            const manhwa = currentManhwaList.find(m => m.id === manhwaId);
            if (manhwa) renderFilteredAndSortedChapters(manhwa, document.getElementById('chapterSearchInputFlex').value.trim());
        } catch (e) { showToast('تعذر الحذف.', 'error'); }
    });
}

function getDynamicRootMargin() {
    let margin = 1500;
    if (navigator.connection) {
        const type = navigator.connection.effectiveType;
        const downlink = navigator.connection.downlink;
        if (downlink !== undefined) {
            if (downlink > 5) margin = 4000; else if (downlink > 1.5) margin = 2000; else if (downlink <= 1.5) margin = 500;
        } else if (type) {
            if (type === '4g') margin = 4000; else if (type === '3g') margin = 1500; else if (type === '2g' || type === 'slow-2g') margin = 500;
        }
    }
    return `${margin}px 0px`;
}

function openPdfReader(manhwaId, title, chapterNum, pagesArray, chapterId) {
    pdfReaderState.manhwaId = manhwaId; pdfReaderState.chapterNum = chapterNum; pdfReaderState.pages = pagesArray;
    currentReaderChapterId = chapterId;
    const manhwa = currentManhwaList.find(m => m.id === manhwaId) || JSON.parse(localStorage.getItem('mg_manhwa_meta_' + manhwaId));
    addToHistory(manhwaId, title, manhwa ? manhwa.cover : '', chapterNum);
    markChapterAsRead(manhwaId, chapterNum);
    
    document.getElementById('pdfHudManhwaTitle').innerText = title;
    document.getElementById('pdfHudChapterTitle').innerText = `الفصل ${formatChapterNum(chapterNum)}`;
    document.getElementById('totalPdfPageNum').innerText = pagesArray.length;

    const container = document.getElementById('pdfPagesContainer');
    container.innerHTML = '';
    const dynamicMargin = getDynamicRootMargin();
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    img.onload = () => img.classList.add('loaded');
                }
                observer.unobserve(img);
            }
        });
    }, { root: document.getElementById('pdfReaderScrollBox'), rootMargin: dynamicMargin, threshold: 0.01 });

    const placeholderSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="800px" viewBox="0 0 100 800"><rect width="100%" height="100%" fill="%230c0c0e"/><text x="50" y="400" fill="%23333344" font-family="sans-serif" font-size="20" text-anchor="middle">جاري التحميل...</text></svg>';

    pagesArray.forEach((url, idx) => {
        const img = document.createElement('img');
        img.className = 'pdf-page-img';
        img.setAttribute('data-page-index', idx);
        img.dataset.src = url;
        img.src = placeholderSvg;
        img.loading = 'lazy';
        img.addEventListener('contextmenu', e => e.preventDefault());
        container.appendChild(img);
        imageObserver.observe(img);
    });

    applyReaderModeStyles();
    document.getElementById('readerView').classList.add('active');
    document.getElementById('appHeaderElement').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    
    if (readerSettings.fullscreen) {
        if (window.Capacitor && window.Capacitor.Plugins.EdgeToEdge) {
            window.Capacitor.Plugins.EdgeToEdge.enable({
                backgroundColor: "transparent",
                navigationBarColor: "#00000000",
                statusBarColor: "#00000000"
            });
        }
        setSystemBarsVisibility(false);
    } else {
        setSystemBarsVisibility(true);
    }

    const positionKey = `mg_reader_pos_${manhwaId}_${chapterNum}`;
    const savedPos = parseInt(localStorage.getItem(positionKey) || '0', 10);
    const scrollBox = document.getElementById('pdfReaderScrollBox');
    setTimeout(() => {
        if (savedPos > 0 && savedPos < pagesArray.length) {
            const target = container.querySelector(`img[data-page-index="${savedPos}"]`);
            if (target) target.scrollIntoView({ block: 'start' });
        } else { scrollBox.scrollTop = 0; scrollBox.scrollLeft = 0; }
        scrollBox.dispatchEvent(new Event('scroll'));
    }, 120);
    setupPdfScrollSpy();
}

function saveReadingPosition(idx) {
    if (!pdfReaderState.manhwaId || !pdfReaderState.chapterNum) return;
    clearTimeout(window._savePosTimer);
    window._savePosTimer = setTimeout(() => {
        try { localStorage.setItem(`mg_reader_pos_${pdfReaderState.manhwaId}_${pdfReaderState.chapterNum}`, idx.toString()); } catch (e) {}
    }, 400);
}

async function closePdfReader() {
    readerOpenGeneration++;
    if (window._readerObserver) { window._readerObserver.disconnect(); window._readerObserver = null; }
    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(e => {});
    
    setSystemBarsVisibility(true);
    
    if (window.Capacitor && window.Capacitor.Plugins.EdgeToEdge) {
        window.Capacitor.Plugins.EdgeToEdge.enable({
            backgroundColor: "#0c0c0e",
            navigationBarColor: "#0c0c0e",
            statusBarColor: "#0c0c0e"
        });
    }

    document.getElementById('readerView').classList.remove('active');
    document.getElementById('appHeaderElement').style.display = 'flex';
    document.getElementById('bottomNav').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('pdfPagesContainer').innerHTML = '';
        pdfReaderState.pages = []; 
    }, 300);
    if (pdfReaderState.manhwaId) {
        await openDetails(pdfReaderState.manhwaId);
        const tcb = document.getElementById('tabChaptersBtn');
        if (tcb) tcb.click();
    }
}

function saveReaderSettings() { try { localStorage.setItem('mg_reader_settings', JSON.stringify(readerSettings)); } catch (e) {} }

function syncReaderSettingsUI() {
    const fullscreenToggle = document.getElementById('fullscreenToggle');
    if (fullscreenToggle) fullscreenToggle.checked = readerSettings.fullscreen;

    document.getElementById('dirVerticalBtn').classList.toggle('active', readerSettings.direction !== 'horizontal');
    document.getElementById('dirHorizontalBtn').classList.toggle('active', readerSettings.direction === 'horizontal');
    const tapToggle = document.getElementById('tapToNavigateToggle');
    if (tapToggle) { tapToggle.checked = readerSettings.tapNavigate; document.getElementById('tapOptionsRow').style.display = readerSettings.tapNavigate ? 'flex' : 'none'; }
    ['right', 'left', 'both'].forEach(m => { const b = document.getElementById(`tap${m.charAt(0).toUpperCase() + m.slice(1)}Btn`); if (b) b.classList.toggle('active', readerSettings.tapMode === m); });
    const sbToggle = document.getElementById('scrollbarToggle');
    if (sbToggle) { sbToggle.checked = readerSettings.scrollbarEnabled; document.getElementById('scrollbarPosRow').style.display = readerSettings.scrollbarEnabled ? 'flex' : 'none'; }
    document.getElementById('posBottomBtn').classList.toggle('active', readerSettings.scrollbarPos === 'bottom');
    document.getElementById('posTopBtn').classList.toggle('active', readerSettings.scrollbarPos === 'top');
    document.getElementById('readerProgressBar').className = `reader-custom-scrollbar ${readerSettings.scrollbarPos}-pos`;
    const gapRange = document.getElementById('pageGapRangeInput'); if (gapRange) gapRange.value = readerSettings.pageGap;
    document.getElementById('gapValueText').innerText = `${readerSettings.pageGap} مم`;
}

function openReaderSettingsPanel() { syncReaderSettingsUI(); document.getElementById('readerSettingsPanel').style.display = 'flex'; }
function closeReaderSettingsPanel() { document.getElementById('readerSettingsPanel').style.display = 'none'; }
function adjustReaderBrightness(val) { document.getElementById('screenDimmer').style.background = `rgba(0,0,0,${val / 100})`; document.getElementById('autoBrightnessBtn').classList.remove('active'); }
function toggleAutoBrightness() {
    const btn = document.getElementById('autoBrightnessBtn'), range = document.getElementById('brightnessRangeInput');
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) { range.value = 15; adjustReaderBrightness(15); }
    else { range.value = 0; adjustReaderBrightness(0); }
}

function setReadDirection(dir) {
    readerSettings.direction = dir;
    document.getElementById('dirVerticalBtn').classList.toggle('active', dir === 'vertical');
    document.getElementById('dirHorizontalBtn').classList.toggle('active', dir === 'horizontal');
    applyReaderModeStyles();
    saveReaderSettings();
}

function applyReaderModeStyles() {
    const scrollBox = document.getElementById('pdfReaderScrollBox');
    const container = document.getElementById('pdfPagesContainer');
    if (readerSettings.direction === 'horizontal') {
        scrollBox.classList.add('horizontal-mode');
        container.style.flexDirection = 'row'; container.style.width = 'max-content'; container.style.direction = 'ltr';
    } else {
        scrollBox.classList.remove('horizontal-mode');
        container.style.flexDirection = 'column'; container.style.width = '100%'; container.style.direction = 'rtl';
    }
    applyPageGap();
}

function adjustPageGap(val) { readerSettings.pageGap = parseInt(val, 10); document.getElementById('gapValueText').innerText = `${readerSettings.pageGap} مم`; applyPageGap(); saveReaderSettings(); }
function applyPageGap() {
    const container = document.getElementById('pdfPagesContainer'); if (!container) return;
    const images = container.querySelectorAll('.pdf-page-img');
    const gapPx = readerSettings.pageGap * 3.78;
    images.forEach((img, idx) => {
        if (readerSettings.direction === 'horizontal') { img.style.marginRight = idx < images.length - 1 ? `${gapPx}px` : '0px'; img.style.marginBottom = '0px'; }
        else { img.style.marginBottom = idx < images.length - 1 ? `${gapPx}px` : '0px'; img.style.marginRight = '0px'; }
    });
}

function toggleTapToNavigate(cb) { readerSettings.tapNavigate = cb.checked; document.getElementById('tapOptionsRow').style.display = cb.checked ? 'flex' : 'none'; saveReaderSettings(); }
function setTapMode(mode) {
    readerSettings.tapMode = mode;
    ['right', 'left', 'both'].forEach(m => { const b = document.getElementById(`tap${m.charAt(0).toUpperCase() + m.slice(1)}Btn`); if (b) b.classList.remove('active'); });
    document.getElementById(`tap${mode.charAt(0).toUpperCase() + mode.slice(1)}Btn`).classList.add('active');
    saveReaderSettings();
}

function toggleScrollbarFeature(cb) {
    readerSettings.scrollbarEnabled = cb.checked;
    document.getElementById('readerProgressBar').style.display = cb.checked ? 'block' : 'none';
    document.getElementById('scrollbarPosRow').style.display = cb.checked ? 'flex' : 'none';
    saveReaderSettings();
}
function setScrollbarPosition(pos) {
    readerSettings.scrollbarPos = pos;
    document.getElementById('readerProgressBar').className = `reader-custom-scrollbar ${pos}-pos`;
    document.getElementById('posBottomBtn').classList.toggle('active', pos === 'bottom');
    document.getElementById('posTopBtn').classList.toggle('active', pos === 'top');
    saveReaderSettings();
}
function toggleFullscreenFeature(cb) {
    readerSettings.fullscreen = cb.checked;
    if (cb.checked) {
        setSystemBarsVisibility(false);
        if (window.Capacitor && window.Capacitor.Plugins.EdgeToEdge) {
            window.Capacitor.Plugins.EdgeToEdge.enable({ backgroundColor: "transparent", navigationBarColor: "#00000000", statusBarColor: "#00000000" }).catch(() => {});
        }
        startForceHide();
    } else {
        if (forceHideInterval) { clearInterval(forceHideInterval); forceHideInterval = null; }
        setSystemBarsVisibility(true);
        if (window.Capacitor && window.Capacitor.Plugins.EdgeToEdge) {
            window.Capacitor.Plugins.EdgeToEdge.enable({ backgroundColor: "#0c0c0e", navigationBarColor: "#0c0c0e", statusBarColor: "#0c0c0e" }).catch(() => {});
        }
    }
    saveReaderSettings();
}

function setSystemBarsVisibility(visible) {
    if (window.Capacitor) {
        if (window.Capacitor.Plugins.StatusBar) {
            visible ? window.Capacitor.Plugins.StatusBar.show() : window.Capacitor.Plugins.StatusBar.hide();
        }
        if (window.Capacitor.Plugins.NavigationBar) {
            visible ? window.Capacitor.Plugins.NavigationBar.show() : window.Capacitor.Plugins.NavigationBar.hide();
        }
    }
}

function togglePageCounterView(cb) { document.getElementById('floatingPageCounter').style.display = cb.checked ? 'block' : 'none'; }

function setupPdfScrollSpy() {
    const scrollBox = document.getElementById('pdfReaderScrollBox');
    const pages = scrollBox.querySelectorAll('.pdf-page-img');
    const currDisplay = document.getElementById('currentPdfPageNum');
    const thumb = document.getElementById('readerProgressThumb');
    let activeIdx = 0;

    if (window._readerObserver) window._readerObserver.disconnect();
    const isHorizontal = readerSettings.direction === 'horizontal';
    const rootMargin = isHorizontal ? '0px -49% 0px -49%' : '-49% 0px -49% 0px';
    window._readerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = parseInt(entry.target.getAttribute('data-page-index'));
                if (!isNaN(idx) && idx !== activeIdx) {
                    activeIdx = idx;
                    currDisplay.innerText = activeIdx + 1;
                    saveReadingPosition(activeIdx);
                    saveReadingProgress(pdfReaderState.manhwaId, currentReaderChapterId, pdfReaderState.chapterNum, activeIdx, activeIdx === (pdfReaderState.pages.length - 1));
                }
            }
        });
    }, { root: scrollBox, rootMargin, threshold: 0 });
    pages.forEach(p => window._readerObserver.observe(p));

    scrollBox.onscroll = () => {
        let pct = 0;
        if (readerSettings.direction === 'horizontal') {
            const max = scrollBox.scrollWidth - scrollBox.clientWidth;
            pct = max > 0 ? (Math.abs(scrollBox.scrollLeft) / max) * 100 : 0;
        } else {
            const max = scrollBox.scrollHeight - scrollBox.clientHeight;
            pct = max > 0 ? (scrollBox.scrollTop / max) * 100 : 0;
        }
        if (thumb) thumb.style.width = `${pct}%`;
    };

    let lastTap = 0, tapTimer = null;
    scrollBox.onclick = (e) => {
        if (e.target.tagName !== 'IMG') return;
        const now = Date.now();
        if (now - lastTap < 300) { if (tapTimer) clearTimeout(tapTimer); tapTimer = null; lastTap = 0; return; }
        lastTap = now;
        tapTimer = setTimeout(() => {
            tapTimer = null;
            const clickX = e.clientX, w = window.innerWidth;
            if (readerSettings.tapNavigate) {
                const isRight = clickX > w * 0.7, isLeft = clickX < w * 0.3;
                let trigger = false;
                if (readerSettings.tapMode === 'both' && (isRight || isLeft)) trigger = true;
                if (readerSettings.tapMode === 'right' && isRight) trigger = true;
                if (readerSettings.tapMode === 'left' && isLeft) trigger = true;
                if (trigger) {
                    if (readerSettings.direction === 'horizontal') scrollBox.scrollBy({ left: isRight ? w : -w, behavior: 'smooth' });
                    else scrollBox.scrollBy({ top: isRight ? window.innerHeight * 0.8 : -window.innerHeight * 0.8, behavior: 'smooth' });
                    return;
                }
            }
            pdfReaderState.hudsVisible = !pdfReaderState.hudsVisible;
            const topHud = document.getElementById('pdfHudTop');
            const counter = document.getElementById('floatingPageCounter');
            const settings = document.getElementById('readerSettingsPanel');
            const progress = document.getElementById('readerProgressBar');
            if (pdfReaderState.hudsVisible) {
                topHud.classList.remove('hidden');
                if (document.getElementById('showPageNumToggle').checked) counter.style.display = 'block';
                if (readerSettings.scrollbarEnabled) progress.style.display = 'block';
            } else {
                topHud.classList.add('hidden'); counter.style.display = 'none';
                progress.style.display = 'none'; settings.style.display = 'none';
                
                if (readerSettings.fullscreen) {
                    if (window.Capacitor) {
                        if (window.Capacitor.Plugins.StatusBar) window.Capacitor.Plugins.StatusBar.hide();
                        if (window.Capacitor.Plugins.NavigationBar) window.Capacitor.Plugins.NavigationBar.hide();
                    }
                }
            }
        }, 300);
    };
}

function toggleReaderSort() {
    readerChapterSortOrder = readerChapterSortOrder === 'oldest' ? 'latest' : 'oldest';
    openReaderChaptersDrawer();
}

function openReaderChaptersDrawer() {
    const overlay = document.getElementById('readerChaptersOverlay');
    const list = document.getElementById('readerChaptersPopupList');
    if (!overlay || !list) return;
    const manhwa = currentManhwaList.find(m => m.id === pdfReaderState.manhwaId) || JSON.parse(localStorage.getItem('mg_manhwa_meta_' + pdfReaderState.manhwaId));
    if (!manhwa) return;
    
    let chaps = [...manhwa.chapters];
    chaps.sort((a, b) => {
        const nA = parseFloat(a.num) || 0, nB = parseFloat(b.num) || 0;
        return readerChapterSortOrder === 'latest' ? nB - nA : nA - nB;
    });

    list.innerHTML = '';
    chaps.forEach(ch => {
        const isCurrent = Number(ch.num) === Number(pdfReaderState.chapterNum);
        list.innerHTML += `<div class="chapter-row-item-new" style="background:${isCurrent ? 'rgba(255,42,95,0.15)' : 'var(--bg-card)'}; border-color:${isCurrent ? 'var(--accent)' : 'var(--border)'}; cursor:pointer;" onclick="document.getElementById('readerChaptersOverlay').style.display='none'; openChapterFromList('${manhwa.id}', ${ch.num})"><span style="font-weight:700; color:${isCurrent ? 'var(--accent)' : '#fff'}">الفصل ${formatChapterNum(ch.num)} ${ch.title ? '- ' + escapeHtml(ch.title) : ''}</span>${isCurrent ? '<i class="fa-solid fa-bookmark" style="color:var(--accent);"></i>' : ''}</div>`;
    });
    overlay.style.display = 'flex';
}

function applyAdvancedSearchModal() { closeAdvancedSearch(); executeLiveSearch(true); }
function resetAdvancedSearchModal() {
    activeFilters = { type: 'all', status: 'all', chapRange: 'all', sort: 'popular', categories: [] };
    document.querySelectorAll('#typeFilters .filter-pill').forEach(p => p.classList.remove('selected'));
    document.querySelector('#typeFilters [data-type="all"]').classList.add('selected');
    document.querySelectorAll('#statusFilters .filter-pill').forEach(p => p.classList.remove('selected'));
    document.querySelector('#statusFilters [data-status="all"]').classList.add('selected');
    document.querySelectorAll('#chapRangeFilters .filter-pill').forEach(p => p.classList.remove('selected'));
    document.querySelector('#chapRangeFilters [data-chap="all"]').classList.add('selected');
    document.querySelectorAll('#sortFilters .filter-pill').forEach(p => p.classList.remove('selected'));
    document.querySelector('#sortFilters [data-sort="popular"]').classList.add('selected');
    document.querySelectorAll('#categoryFilters .filter-pill').forEach(p => p.classList.remove('selected'));
}

function initPullToRefresh() {
    let startX = 0, startY = 0, pulling = false, refreshing = false;
    const indicator = document.getElementById('ptrIndicator');
    const spinner = document.getElementById('ptrIcon');
    const TRIGGER = 80;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && !refreshing) { 
            startY = e.touches[0].clientY; 
            startX = e.touches[0].clientX;
            pulling = false; 
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (refreshing || window.scrollY > 0 || startY === 0) return;
        const distY = e.touches[0].clientY - startY;
        const distX = Math.abs(e.touches[0].clientX - startX);
        
        if (distY > 5 && distY > distX * 1.5) {
            pulling = true;
            const y = Math.min(distY * 0.5, 60);
            indicator.style.transform = `translate(-50%, ${y}px)`;
            indicator.classList.add('visible');
            spinner.style.transform = `rotate(${distY * 4}deg)`;
        }
    }, { passive: true });

    window.addEventListener('touchend', async (e) => {
        if (!pulling) { startY = 0; return; }
        const distY = e.changedTouches[0].clientY - startY;
        startY = 0; pulling = false;

        if (distY > TRIGGER) {
            refreshing = true;
            spinner.style.transform = '';
            spinner.classList.add('spinning');
            indicator.style.transform = `translate(-50%, 40px)`;
            try {
                await fetchManhwaFromDB(true);
                await fetchAnnouncements();
                await fetchUserDBNotifications();
                if (document.getElementById('homeView').classList.contains('active')) renderActiveMainGrid();
            } catch (e) {}
            setTimeout(() => {
                refreshing = false;
                spinner.classList.remove('spinning');
                indicator.classList.remove('visible');
                indicator.style.transform = 'translate(-50%, -60px)';
            }, 500);
        } else {
            indicator.classList.remove('visible');
            indicator.style.transform = 'translate(-50%, -60px)';
            spinner.style.transform = '';
        }
    });
}

let isAppOffline = !navigator.onLine;
function showNetworkBanner(isOnline) {
    const banner = document.getElementById('networkStatusBanner');
    const icon = document.getElementById('networkIcon');
    const text = document.getElementById('networkText');
    const offlineOverlay = document.getElementById('offlineOverlay');
    
    if (isOnline) {
        if (!isAppOffline) return;
        isAppOffline = false;
        offlineOverlay.style.display = 'none';
        banner.style.background = '#2ecc71';
        banner.style.color = '#fff';
        icon.className = 'fa-solid fa-wifi';
        icon.style.color = '#fff';
        text.innerText = 'تم استعادة اتصالك بالإنترنت';
        banner.style.display = 'block';
        setTimeout(() => { banner.style.transform = 'translateY(0)'; }, 10);
        setTimeout(() => {
            banner.style.transform = 'translateY(-100%)';
            setTimeout(() => { banner.style.display = 'none'; }, 300);
        }, 3000);
        fetchManhwaFromDB(true).then(() => {
            if (document.getElementById('homeView').classList.contains('active')) renderActiveMainGrid();
        });
    } else {
        if (isAppOffline) return;
        isAppOffline = true;
        banner.style.display = 'none';
        offlineOverlay.style.display = 'flex';
    }
}

async function initNativeNetworkListener() {
    if (window.Capacitor && window.Capacitor.Plugins.Network) {
        const { Network } = window.Capacitor.Plugins;
        try {
            const status = await Network.getStatus();
            if (!status.connected) showNetworkBanner(false);
            Network.addListener('networkStatusChange', (status) => {
                showNetworkBanner(status.connected);
            });
            return;
        } catch (e) {}
    }
    if (!navigator.onLine) showNetworkBanner(false);
    window.addEventListener('online', () => showNetworkBanner(true));
    window.addEventListener('offline', () => showNetworkBanner(false));
}

setInterval(async () => {
    if (currentUser) {
        await checkUserBanStatus();
        updateCommentInputState();
    }
}, 300000);

// ═══════════════════════════════════════════════════════════
// App Initialization
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    try {
        updateViewToggleIcon();
        renderCategoriesFilterUI();
        initPullToRefresh();
        initNativeNetworkListener();
        navigateTo('home');

        if (window.Capacitor && window.Capacitor.Plugins.SocialLogin) {
            try {
                await window.Capacitor.Plugins.SocialLogin.initialize({
                    google: {
                        webClientId: '901201695721-4kokplipcf00epts55u37vjskumr5fv.apps.googleusercontent.com',
                        skipAuthOnlyAuthorizationAfterSignIn: true
                    }
                });
                console.log("SocialLogin initialized successfully");
            } catch (initErr) {
                console.error("SocialLogin initialization error:", initErr);
            }
        }

        try { await initAuthSystem(); } catch(e) { console.error("Auth init failed", e); }
        
        setupUserNotificationsRealtime(); 
        setTimeout(fetchUserDBNotifications, 2000);

        document.addEventListener('click', (e) => {
            const sm = document.getElementById('sortMenuPopup'); 
            if (sm && !e.target.closest('#sortDropdownBtn') && !e.target.closest('#sortMenuPopup')) {
                sm.style.display = 'none';
            }
            const csm = document.getElementById('commentSortMenuPopup'); 
            if (csm && !e.target.closest('#commentSortMenuBtn') && !e.target.closest('#commentSortMenuPopup')) {
                csm.style.display = 'none';
            }
        });

        const spoilerBtn = document.getElementById('spoilerToggleBtn');
        if (spoilerBtn) {
            spoilerBtn.addEventListener('click', () => {
                if (isUserBanned) { showToast("لا يمكنك استخدام هذا الخيار لأنك محظور.", "error"); return; }
                isSpoilerActive = !isSpoilerActive;
                if (isSpoilerActive) {
                    spoilerBtn.classList.add('active-spoiler');
                    showToast("تم تحديد التعليق كـ (حرق أحداث)", "info", 2000);
                } else {
                    spoilerBtn.classList.remove('active-spoiler');
                }
            });
        }

        try {
            if (!localStorage.getItem('mg_notifs_migrated_v2')) {
                appNotifications = appNotifications.map(n => {
                    const bad = (n.title && /&(amp|lt|gt|quot|#39);/.test(n.title)) || (n.desc && /&(amp|lt|gt|quot|#39);/.test(n.desc));
                    if (bad) { const unesc = s => s ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : s; return { ...n, title: unesc(n.title), desc: unesc(n.desc) }; }
                    return n;
                });
                localStorage.setItem('mg_notifications', JSON.stringify(appNotifications));
                localStorage.setItem('mg_notifs_migrated_v2', 'true');
            }
        } catch (e) {}

        const descText = document.getElementById('workDescription');
        const toggleDescBtn = document.getElementById('btnToggleDesc');
        if (toggleDescBtn) toggleDescBtn.addEventListener('click', () => { descText.classList.toggle('expanded'); toggleDescBtn.querySelector('i').className = descText.classList.contains('expanded') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'; });

        const tabDetailsBtn = document.getElementById('tabDetailsBtn'), tabChaptersBtn = document.getElementById('tabChaptersBtn');
        const tabDetailsContent = document.getElementById('tabDetailsContent'), tabChaptersContent = document.getElementById('tabChaptersContent');
        if (tabDetailsBtn && tabChaptersBtn) {
            tabDetailsBtn.addEventListener('click', () => { tabDetailsBtn.classList.add('active'); tabChaptersBtn.classList.remove('active'); tabDetailsContent.style.display = 'block'; tabChaptersContent.style.display = 'none'; });
            tabChaptersBtn.addEventListener('click', () => { tabChaptersBtn.classList.add('active'); tabDetailsBtn.classList.remove('active'); tabDetailsContent.style.display = 'none'; tabChaptersContent.style.display = 'flex'; });
        }

        document.getElementById('detailsBackBtn')?.addEventListener('click', () => navigateTo(previousSearchQueryLocation));

        const btnLibrary = document.getElementById('btnLibrary');
        btnLibrary?.addEventListener('click', () => {
            if (!currentOpenManhwaId) return;
            openAddToLibraryModal(currentOpenManhwaId);
        });

        const btnRatingOpen = document.getElementById('btnRatingModalOpen');
        btnRatingOpen?.addEventListener('click', async () => {
            if (!checkGuestPermission('rating')) return;
            document.getElementById('ratingModalOverlay').style.display = 'flex';
            
            currentSelectedRating = 0;
            let hasRated = false;
            
            if (currentUser && currentOpenManhwaId) {
                try {
                    const { data } = await db.from('ratings').select('score').eq('manhwa_id', currentOpenManhwaId).eq('user_id', currentUser.id).single();
                    if (data) {
                        currentSelectedRating = data.score;
                        hasRated = true;
                    }
                } catch (e) {}
            }
            
            highlightStars(currentSelectedRating);
            
            const deleteBtn = document.getElementById('deleteRatingBtn');
            if (hasRated) {
                deleteBtn.style.display = 'block';
            } else {
                deleteBtn.style.display = 'none';
            }
        });

        document.getElementById('closeRatingModalBtn')?.addEventListener('click', () => { document.getElementById('ratingModalOverlay').style.display = 'none'; });
        
        const starIcons = document.querySelectorAll('#interactiveStars i');
        starIcons.forEach(star => {
            star.addEventListener('click', () => { currentSelectedRating = parseInt(star.getAttribute('data-value')); highlightStars(currentSelectedRating); });
        });
        
        function highlightStars(val) {
            starIcons.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-value'));
                if (sVal <= val) { 
                    s.classList.add('selected'); 
                    s.style.color = 'var(--accent)'; 
                }
                else { 
                    s.classList.remove('selected'); 
                    s.style.color = '#444'; 
                }
            });
        }

        document.getElementById('submitRatingBtn')?.addEventListener('click', async () => {
            if (!checkGuestPermission('rating')) return;
            if (currentSelectedRating === 0) { showToast("اختر درجة تقييم أولاً.", "error"); return; }
            if (!currentOpenManhwaId) return;
            
            const btn = document.getElementById('submitRatingBtn'); 
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري...`; 
            btn.disabled = true;
            
            try {
                const { data, error } = await db.rpc('rate_manhwa_v2', { 
                    p_manhwa_id: currentOpenManhwaId, 
                    p_score: currentSelectedRating 
                });
                
                if (error) throw error;
                
                const item = currentManhwaList.find(m => m.id === currentOpenManhwaId);
                if (item && data) {
                    item.rating_average = data.average;
                    item.rating_count = data.count;
                    updateDetailsRatingUI(item);
                }
                
                document.getElementById('ratingModalOverlay').style.display = 'none';
                
            } catch (err) { 
                console.error("Rating Error:", err);
                showToast("خطأ: " + (err.message || "تعذر حفظ التقييم."), "error", 5000); 
            }
            finally { 
                btn.innerHTML = `تأكيد التقييم`; 
                btn.disabled = false; 
            }
        });

        document.getElementById('deleteRatingBtn')?.addEventListener('click', async () => {
            if (!currentOpenManhwaId) return;
            const btn = document.getElementById('deleteRatingBtn');
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; 
            btn.disabled = true;
            
            try {
                const { error } = await db.rpc('delete_rating', { p_manhwa_id: currentOpenManhwaId });
                if (error) throw error;
                
                await fetchManhwaFromDB(true);
                const item = currentManhwaList.find(m => m.id === currentOpenManhwaId);
                if (item) updateDetailsRatingUI(item);
                
                document.getElementById('ratingModalOverlay').style.display = 'none';
            } catch (err) {
                showToast("تعذر حذف التقييم.", "error");
            } finally {
                btn.innerHTML = `حذف التقييم`;
                btn.disabled = false;
            }
        });

        document.getElementById('closeTitleModalBtn')?.addEventListener('click', () => { document.getElementById('titleModalOverlay').style.display = 'none'; });
        document.getElementById('copyFullTitleBtn')?.addEventListener('click', () => {
            const t = document.getElementById('fullTitleModalText').innerText;
            copyTextNative(t).then((ok) => { if (ok) document.getElementById('titleModalOverlay').style.display = 'none'; else showToast("تعذر النسخ.", "error"); });
        });

        document.getElementById('commentsPageBackBtn')?.addEventListener('click', () => {
            if (!currentOpenManhwaId) return;
            if (currentCommentContextType === 'chapter') {
                openDetails(currentOpenManhwaId).then(() => {
                    const tcb = document.getElementById('tabChaptersBtn');
                    if (tcb) tcb.click();
                });
            } else openDetails(currentOpenManhwaId);
        });

        document.getElementById('indepSendCommentBtn').onclick = sendIndependentComment;
        document.getElementById('indepCommentInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('indepSendCommentBtn').click(); } });
        document.getElementById('cancelReplyBtn')?.addEventListener('click', cancelReplyingMode);

        const closeRulesBtn = document.getElementById('closeRulesModalBtn');
        const rulesOverlay = document.getElementById('rulesModalOverlay');
        document.getElementById('openRulesModalBtn')?.addEventListener('click', () => rulesOverlay.style.display = 'flex');
        closeRulesBtn?.addEventListener('click', () => rulesOverlay.style.display = 'none');

        document.getElementById('closeBottomRulesBarBtn')?.addEventListener('click', () => { document.getElementById('bottomRulesBar').style.display = 'none'; });

        const commentSortBtn = document.getElementById('commentSortMenuBtn'), commentSortPopup = document.getElementById('commentSortMenuPopup');
        commentSortBtn?.addEventListener('click', (e) => { e.stopPropagation(); commentSortPopup.style.display = commentSortPopup.style.display === 'flex' ? 'none' : 'flex'; });
        document.querySelectorAll('[data-comments-sort]').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('[data-comments-sort]').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
                currentCommentsSortOrder = el.getAttribute('data-comments-sort');
                commentSortPopup.style.display = 'none';
                sortAndRenderIndependentComments();
            });
        });

        document.getElementById('cancelReportBtn')?.addEventListener('click', () => { document.getElementById('reportModalOverlay').style.display = 'none'; });

        const emojiToggleBtn = document.getElementById('emojiPickerToggleBtn');
        const emojiPopup = document.getElementById('emojiPickerPopup');
        emojiToggleBtn?.addEventListener('click', (e) => { 
            if(isUserBanned) { showToast("لا يمكنك استخدام الإيموجي لأنك محظور.", "error"); return; }
            e.stopPropagation(); emojiPopup.style.display = emojiPopup.style.display === 'grid' ? 'none' : 'grid'; 
        });
        document.querySelectorAll('.emoji-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.getElementById('indepCommentInput');
                if (input) { input.value += el.innerText; input.focus(); }
            });
        });
        document.addEventListener('click', (e) => {
            if (!emojiPopup.contains(e.target) && e.target !== emojiToggleBtn && !emojiToggleBtn?.contains(e.target)) emojiPopup.style.display = 'none';
        });

        document.getElementById('openDrawerBtn')?.addEventListener('click', () => toggleDrawer(false));
        document.getElementById('drawerOverlay')?.addEventListener('click', () => toggleDrawer(true));
        document.getElementById('viewToggleBtn')?.addEventListener('click', toggleViewMode);
        document.getElementById('headerSearchBtn')?.addEventListener('click', () => navigateTo('search'));
        document.getElementById('drawerSearchBtn')?.addEventListener('click', () => { toggleDrawer(true); navigateTo('search'); });
        document.getElementById('searchBackBtn')?.addEventListener('click', () => navigateTo(previousSearchQueryLocation));
        document.getElementById('openAdvSearchFromPageBtn')?.addEventListener('click', openAdvancedSearch);
        document.getElementById('closeAdvSearchBtn')?.addEventListener('click', closeAdvancedSearch);

        document.getElementById('clearOldNotifsBtn')?.addEventListener('click', openDeleteAllConfirmModal);

        const pf = document.getElementById('notifPrefFollowed'), pv = document.getElementById('notifPrefFav'), pn = document.getElementById('notifPrefNews');
        if (pf) { pf.checked = notifPreferences.followed; pf.onchange = e => { notifPreferences.followed = e.target.checked; localStorage.setItem('mg_notif_prefs', JSON.stringify(notifPreferences)); }; }
        if (pv) { pv.checked = notifPreferences.fav; pv.onchange = e => { notifPreferences.fav = e.target.checked; localStorage.setItem('mg_notif_prefs', JSON.stringify(notifPreferences)); }; }
        if (pn) { pn.checked = notifPreferences.news; pn.onchange = e => { notifPreferences.news = e.target.checked; localStorage.setItem('mg_notif_prefs', JSON.stringify(notifPreferences)); }; }

        const liveInput = document.getElementById('liveSearchInput');
        const clearTextBtn = document.getElementById('clearSearchTextBtn');
        if (liveInput) {
            liveInput.addEventListener('input', () => debouncedLiveSearch(false));
            liveInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); debouncedLiveSearch(true); liveInput.blur(); } });
        }
        if (clearTextBtn) clearTextBtn.addEventListener('click', () => { liveInput.value = ''; clearTextBtn.style.display = 'none'; executeLiveSearch(false); liveInput.focus(); });
        document.getElementById('clearAllHistoryBtn')?.addEventListener('click', clearAllSearchHistory);

        document.querySelectorAll('#typeFilters .filter-pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#typeFilters .filter-pill').forEach(x => x.classList.remove('selected')); p.classList.add('selected'); activeFilters.type = p.getAttribute('data-type'); }));
        document.querySelectorAll('#statusFilters .filter-pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#statusFilters .filter-pill').forEach(x => x.classList.remove('selected')); p.classList.add('selected'); activeFilters.status = p.getAttribute('data-status'); }));
        document.querySelectorAll('#chapRangeFilters .filter-pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#chapRangeFilters .filter-pill').forEach(x => x.classList.remove('selected')); p.classList.add('selected'); activeFilters.chapRange = p.getAttribute('data-chap'); }));
        document.querySelectorAll('#sortFilters .filter-pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#sortFilters .filter-pill').forEach(x => x.classList.remove('selected')); p.classList.add('selected'); activeFilters.sort = p.getAttribute('data-sort'); }));

        document.getElementById('applyAdvSearchBtn')?.addEventListener('click', applyAdvancedSearchModal);
        document.getElementById('resetAdvSearchBtn')?.addEventListener('click', resetAdvancedSearchModal);

        document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => { toggleDrawer(true); navigateTo(el.getAttribute('data-nav')); }));
        document.getElementById('drawerProfileLink')?.addEventListener('click', () => { toggleDrawer(true); navigateTo('profile'); });
        document.getElementById('logoutDrawerBtn')?.addEventListener('click', () => { toggleDrawer(true); if (isUserLoggedIn()) handleLogout(); else renderAuthModalState('main'); });
        document.getElementById('profileLoginTriggerBtn')?.addEventListener('click', () => renderAuthModalState('main'));
        document.getElementById('profileLogoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('profileDeleteAccountBtn')?.addEventListener('click', handleDeleteAccount);
        
        document.getElementById('submitRequestBtn')?.addEventListener('click', submitUserRequest);
        document.getElementById('headerNotifBtn')?.addEventListener('click', () => navigateTo('notifications'));
        document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsRead);

        document.querySelectorAll('#libraryTabs .lib-tab').forEach(el => {
            el.addEventListener('click', () => switchLibraryTab(el.getAttribute('data-ltab')));
        });

        document.querySelectorAll('#historyTabs .lib-tab').forEach(el => {
            el.addEventListener('click', () => switchHistoryTab(el.getAttribute('data-htab')));
        });

        document.getElementById('confirmSheetBtnYes')?.addEventListener('click', () => {
            if (currentConfirmAction) currentConfirmAction();
            closeConfirmationSheet();
        });

        try { await fetchAppSettings(); } catch(e) {}
        try { await fetchCategories(); } catch(e) {}
        try { await fetchAnnouncements(); } catch(e) {}
        try { await fetchManhwaFromDB(); } catch(e) {}
        
        if (document.getElementById('homeView').classList.contains('active')) {
            renderActiveMainGrid();
        }
    } catch (e) {
        console.error("Critical failure during init", e);
    }
});
