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
