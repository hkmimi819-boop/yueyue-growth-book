/**
 * Supabase 认证 + 加密云端存储
 */
(function (global) {
  'use strict';

  const LEGACY_KEY = 'babyGrowthBook_v1';
  const SESSION_PWD_KEY = 'babybook_session_unlock';
  const EMPTY_DATA = () => ({
    growth: [],
    feeding: [],
    milestones: {},
    diary: {},
    jaundice: [],
    stool: [],
    temperature: [],
    sleep: [],
    medicine: [],
  });

  function normalizeData(data) {
    const base = EMPTY_DATA();
    if (!data || typeof data !== 'object') return base;
    return {
      growth: Array.isArray(data.growth) ? data.growth : [],
      feeding: Array.isArray(data.feeding) ? data.feeding : [],
      milestones: data.milestones && typeof data.milestones === 'object' ? data.milestones : {},
      diary: data.diary && typeof data.diary === 'object' ? data.diary : {},
      jaundice: Array.isArray(data.jaundice) ? data.jaundice : [],
      stool: Array.isArray(data.stool) ? data.stool : [],
      temperature: Array.isArray(data.temperature) ? data.temperature : [],
      sleep: Array.isArray(data.sleep) ? data.sleep : [],
      medicine: Array.isArray(data.medicine) ? data.medicine : [],
    };
  }

  let supabase = null;
  let cache = EMPTY_DATA();
  let cryptoKey = { password: null, salt: null };
  let currentUser = null;
  let persistTimer = null;
  let saving = false;
  let userProfile = { baby_name: '宝宝', baby_gender: 'boy' };
  const REQUEST_TIMEOUT_MS = 20000;

  function applyUserProfile(profile) {
    userProfile = {
      baby_name: global.BabyBookTheme?.normalizeName(profile?.baby_name) || '宝宝',
      baby_gender: profile?.baby_gender === 'girl' ? 'girl' : 'boy',
    };
    if (global.BabyBookTheme) {
      global.BabyBookTheme.apply(userProfile.baby_gender, userProfile.baby_name);
    }
  }

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`${label || '请求'}超时，请检查网络后重试`)),
          REQUEST_TIMEOUT_MS
        );
      }),
    ]);
  }

  function hasAnyData(data) {
    const d = normalizeData(data);
    return (
      d.growth.length > 0 ||
      d.feeding.length > 0 ||
      Object.keys(d.milestones).length > 0 ||
      Object.keys(d.diary).length > 0 ||
      d.jaundice.length > 0 ||
      d.stool.length > 0 ||
      d.temperature.length > 0 ||
      d.sleep.length > 0 ||
      d.medicine.length > 0
    );
  }

  function getConfig() {
    return global.SUPABASE_CONFIG;
  }

  function getConfigIssue() {
    const c = getConfig();
    if (typeof c === 'undefined') {
      return 'config.js 未加载。请用 http://localhost:8080 打开，并在 baby-growth-book 目录启动服务器。';
    }
    if (!c.url || String(c.url).includes('YOUR_PROJECT')) {
      return 'config.js 里的 url 仍是占位符，请填入 Supabase Project URL。';
    }
    if (!c.anonKey || String(c.anonKey).includes('YOUR_ANON')) {
      return 'config.js 里的 anonKey 仍是占位符，请填入 anon public 密钥。';
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      return 'Supabase 脚本库加载失败。请检查网络，或换 Chrome/Safari 无痕窗口重试。';
    }
    return null;
  }

  function hasConfig() {
    return !getConfigIssue();
  }

  function initSupabase() {
    if (!hasConfig()) return null;
    return global.supabase.createClient(getConfig().url, getConfig().anonKey);
  }

  function getCache() {
    return cache;
  }

  function setCache(data) {
    cache = normalizeData(data);
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  async function loadFromCloud() {
    const { data: rows, error } = await supabase
      .from('family_records')
      .select('encrypted_data')
      .eq('user_id', currentUser.id)
      .limit(2);

    if (error) throw error;
    const data = rows?.[0];
    if (!data || !data.encrypted_data) return EMPTY_DATA();

    const raw = await BabyBookCrypto.decryptJson(
      data.encrypted_data,
      cryptoKey.password,
      cryptoKey.salt
    );
    return normalizeData(raw);
  }

  async function saveToCloud() {
    if (!currentUser || !cryptoKey.password) {
      throw new Error('未登录，无法同步云端');
    }
    if (!cryptoKey.salt) {
      throw new Error('加密配置缺失，请退出后重新登录');
    }
    const encrypted = await BabyBookCrypto.encryptJson(
      cache,
      cryptoKey.password,
      cryptoKey.salt
    );
    const { error } = await supabase.from('family_records').upsert(
      {
        user_id: currentUser.id,
        encrypted_data: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }

  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      if (saving) return;
      saving = true;
      try {
        await saveToCloud();
        global.__babyBookLastCloudSync = Date.now();
        const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        showSyncStatus(`已同步到 Supabase 云端 · ${t}`, 'ok');
      } catch (e) {
        console.error('云端同步失败', e);
        showSyncStatus('云端同步失败：' + (e.message || '请检查网络'), 'err');
        showGlobalError('云端保存失败，请检查网络后重试');
      } finally {
        saving = false;
      }
    }, 600);
  }

  function persistNow() {
    clearTimeout(persistTimer);
    return saveToCloud();
  }

  function showSyncStatus(text, type) {
    const el = document.getElementById('sync-status');
    const footerHint = document.getElementById('footer-sync-hint');
    if (el) {
      el.textContent = text;
      el.className = 'sync-status' + (type ? ` sync-${type}` : '');
      if (type === 'ok') {
        setTimeout(() => {
          if (el.textContent === text) el.textContent = '';
        }, 3000);
      }
    }
    if (footerHint && text) {
      footerHint.textContent = text;
      footerHint.className = 'footer-hint' + (type === 'err' ? ' sync-err' : '');
      if (type === 'ok') {
        setTimeout(() => {
          if (footerHint.textContent === text) footerHint.textContent = '';
        }, 5000);
      }
    }
  }

  function loadLegacyLocal() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  async function ensureProfile(salt, babyName, babyGender) {
    const name = global.BabyBookTheme?.normalizeName(babyName) || '宝宝';
    const gender = babyGender === 'girl' ? 'girl' : 'boy';

    const { data: existing, error: readErr } = await supabase
      .from('profiles')
      .select('encryption_salt, baby_name, baby_gender')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (readErr) throw readErr;

    if (existing) {
      cryptoKey.salt = existing.encryption_salt;
      return existing;
    }

    const { error: insertErr } = await supabase.from('profiles').insert({
      id: currentUser.id,
      encryption_salt: salt,
      baby_name: name,
      baby_gender: gender,
    });

    if (insertErr) throw insertErr;
    cryptoKey.salt = salt;
    return { encryption_salt: salt, baby_name: name, baby_gender: gender };
  }

  async function fetchProfileSalt() {
    const { data, error } = await supabase
      .from('profiles')
      .select('encryption_salt, baby_name, baby_gender')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const salt = BabyBookCrypto.randomSalt();
      return ensureProfile(salt, '宝宝', 'boy');
    }

    cryptoKey.salt = data.encryption_salt;
    if (!data.baby_gender) data.baby_gender = 'boy';
    return data;
  }

  async function onAuthSuccess(password, isNewUser, babyName, babyGender) {
    cryptoKey.password = password;
    let profile;
    if (isNewUser) {
      const salt = BabyBookCrypto.randomSalt();
      profile = await withTimeout(ensureProfile(salt, babyName, babyGender), '创建配置');
    } else {
      profile = await withTimeout(fetchProfileSalt(), '加载配置');
    }
    applyUserProfile(profile);

    let cloudData;
    try {
      cloudData = await withTimeout(loadFromCloud(), '加载数据');
    } catch (e) {
      if (e.message === 'INVALID_PAYLOAD' || e.name === 'OperationError') {
        throw new Error('DECRYPT_FAILED');
      }
      throw e;
    }

    const legacy = loadLegacyLocal();
    const cloudEmpty = !hasAnyData(cloudData);
    let mergedLocal = false;

    if (legacy && cloudEmpty && hasAnyData(legacy)) {
      cache = normalizeData(legacy);
      mergedLocal = true;
      try {
        await persistNow();
      } catch (e) {
        console.warn('本地记录合并到云端失败', e);
      }
    } else {
      cache = cloudData;
    }

    sessionStorage.setItem(SESSION_PWD_KEY, password);
    if (mergedLocal) {
      global.__babyBookMergedLocal = true;
    }

    try {
      await persistNow();
      global.__babyBookLastCloudSync = Date.now();
    } catch (e) {
      console.error('登录后首次云端同步失败', e);
      throw new Error('无法写入云端：' + (e.message || '请检查网络'));
    }
  }

  function showGlobalError(msg) {
    const el = document.getElementById('global-auth-error');
    const authErr = document.getElementById('auth-error');
    if (el) {
      el.textContent = msg || '';
      el.hidden = !msg;
    }
    if (authErr) {
      authErr.textContent = msg || '';
      authErr.hidden = !msg;
    }
  }

  async function finishLogin() {
    if (!global.BabyBookApp || typeof global.BabyBookApp.start !== 'function') {
      throw new Error('应用脚本未加载，请刷新页面（确保 app.js 已加载）');
    }
    await global.BabyBookApp.start();
    showApp();
    if (global.__babyBookMergedLocal) {
      showSyncStatus('已自动合并本设备历史记录', 'ok');
      delete global.__babyBookMergedLocal;
    }
  }

  function showAuth() {
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-main');
    auth.hidden = false;
    auth.style.display = '';
    app.hidden = true;
    app.style.display = 'none';
  }

  function showApp() {
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-main');
    auth.hidden = true;
    auth.style.display = 'none';
    app.hidden = false;
    app.style.display = '';
    const email = currentUser?.email || '';
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = email;
  }

  function showConfigError() {
    const issue = getConfigIssue() || '未知配置问题';
    const screen = document.getElementById('auth-screen');
    screen.hidden = false;
    document.getElementById('app-main').hidden = true;
    screen.innerHTML = `
      <div class="auth-card auth-card-wide">
        <h2>⚙️ 无法连接 Supabase</h2>
        <p class="auth-error" style="display:block">${issue}</p>
        <p style="margin-top:12px;font-size:0.9rem;color:var(--text-light)">排查步骤：</p>
        <ol style="font-size:0.85rem;color:var(--text-light);padding-left:1.2rem;line-height:1.6">
          <li><strong>Netlify</strong>：Site configuration → Environment variables 添加 <code>SUPABASE_URL</code>、<code>SUPABASE_ANON_KEY</code>，然后重新 Deploy</li>
          <li><strong>本地</strong>：复制 <code>config.example.js</code> 为 <code>config.js</code> 并填入密钥</li>
          <li>部署后打开 <a href="/config.js" target="_blank">/config.js</a>，应能看到 Project URL（不是空字符串）</li>
        </ol>
        <p style="font-size:0.85rem;margin-top:8px">详见 <strong>NETLIFY_SETUP.md</strong></p>
      </div>`;
  }

  function normalizeInviteCode(raw) {
    return String(raw || '').trim().toLowerCase();
  }

  function mapInviteRpcError(error, step) {
    console.error(step, error);
    const code = error?.code || '';
    const msg = error?.message || '';
    if (code === 'PGRST202' || msg.includes('Could not find the function')) {
      return '邀请码功能未就绪：请在 Supabase 执行 invite-codes.sql 和 fix-invite-validation.sql';
    }
    return `${step}失败：${msg || '请稍后重试'}`;
  }

  async function assertInviteCodeValid(inviteCode) {
    const code = normalizeInviteCode(inviteCode);
    if (!code) {
      throw new Error('请填写邀请码');
    }
    const { data, error } = await supabase.rpc('check_invite_code', { p_code: code });
    if (error) {
      throw new Error(mapInviteRpcError(error, '邀请码校验'));
    }
    if (data !== true) {
      throw new Error(
        '邀请码无效或已被使用。请确认：① 已在 Supabase 生成邀请码 ② 该码 used=false ③ 输入无多余空格'
      );
    }
    return code;
  }

  async function redeemInviteCode(inviteCode) {
    const code = normalizeInviteCode(inviteCode);
    const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: code });
    if (error) {
      throw new Error(mapInviteRpcError(error, '邀请码核销'));
    }
    if (data !== true) {
      await supabase.auth.signOut();
      currentUser = null;
      throw new Error('邀请码已被他人使用，请换一个新码注册（若邮箱已占用请直接登录）');
    }
  }

  async function signUp(email, password, babyName, babyGender, inviteCode) {
    const code = await assertInviteCodeValid(inviteCode);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const m = error.message || '';
      if (/already|registered|exists/i.test(m)) {
        throw new Error('该邮箱已注册，请直接登录');
      }
      throw new Error('账号注册失败：' + m);
    }
    if (!data.user) {
      throw new Error('账号注册失败，请稍后重试');
    }
    if (!data.session) {
      throw new Error(
        '注册已提交，但需邮件验证后才能登录。请在 Supabase 关闭 Confirm email，或验证邮箱后再登录'
      );
    }
    currentUser = data.user;

    await redeemInviteCode(code);

    await onAuthSuccess(password, true, babyName, babyGender);
  }

  async function signIn(email, password) {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      '登录'
    );
    if (error) throw error;
    currentUser = data.user;
    await onAuthSuccess(password, false);
  }

  async function unlockOrSignIn(email, password) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      await onAuthSuccess(password, false);
      return;
    }
    await signIn(email, password);
  }

  async function signOut() {
    await supabase.auth.signOut();
    sessionStorage.removeItem(SESSION_PWD_KEY);
    currentUser = null;
    cryptoKey = { password: null, salt: null };
    cache = EMPTY_DATA();
    userProfile = { baby_name: '宝宝', baby_gender: 'boy' };
    if (global.BabyBookTheme) {
      global.BabyBookTheme.apply('boy', '宝宝');
    }
    showAuth();
  }

  async function resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  function saveData(data) {
    if (!isLoggedIn() || !cryptoKey.password) {
      showGlobalError('请先登录后再保存，数据将同步到 Supabase 云端');
      showAuth();
      return;
    }
    cache = normalizeData(data);
    schedulePersist();
  }

  function bindAuthUI() {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const authError = document.getElementById('auth-error');
    const btnLogout = document.getElementById('btn-logout');
    const formReset = document.getElementById('form-reset');
    const linkForgot = document.getElementById('link-forgot');
    const linkBackLogin = document.getElementById('link-back-login');

    function setError(msg) {
      showGlobalError(msg);
    }

    function clearError() {
      showGlobalError('');
    }

    function formatAuthError(err) {
      const msg = err?.message || '';
      if (msg.includes('Email not confirmed') || err?.code === 'email_not_confirmed') {
        return '邮箱尚未确认。请在 Supabase 执行 fix-email-confirmed.sql 或关闭 Confirm email。';
      }
      if (msg.includes('Cannot coerce') || err?.code === 'PGRST116') {
        return '云端数据异常，请刷新重试；若仍失败请联系技术支持。';
      }
      if (msg.includes('邀请码')) {
        return msg;
      }
      return msg || '操作失败';
    }

    function switchAuthTab(mode) {
      const isLogin = mode === 'login';
      tabLogin.classList.toggle('active', isLogin);
      tabRegister.classList.toggle('active', !isLogin);
      formLogin.hidden = !isLogin;
      formRegister.hidden = isLogin;
      formReset.hidden = true;
      clearError();
    }

    const registerNameInput = document.getElementById('register-baby-name');
    const genderInputs = document.querySelectorAll('input[name="register-gender"]');

    function getRegisterPreview() {
      const name = registerNameInput?.value.trim() || '宝宝';
      const gender =
        document.querySelector('input[name="register-gender"]:checked')?.value || 'boy';
      return { name, gender };
    }

    function updateRegisterPreview() {
      if (!global.BabyBookTheme || formRegister.hidden) return;
      const { name, gender } = getRegisterPreview();
      global.BabyBookTheme.previewRegister(name, gender);
    }

    tabLogin.addEventListener('click', () => {
      switchAuthTab('login');
      if (global.BabyBookTheme) global.BabyBookTheme.applyTheme('boy');
    });
    tabRegister.addEventListener('click', () => {
      switchAuthTab('register');
      updateRegisterPreview();
    });

    registerNameInput?.addEventListener('input', updateRegisterPreview);
    genderInputs.forEach((input) => input.addEventListener('change', updateRegisterPreview));

    linkForgot?.addEventListener('click', (e) => {
      e.preventDefault();
      formLogin.hidden = true;
      formRegister.hidden = true;
      formReset.hidden = false;
      setError('');
    });

    linkBackLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthTab('login');
    });

    const authStatus = document.getElementById('auth-status');

    function setLoading(on, text) {
      const btn = formLogin.querySelector('button[type="submit"]');
      btn.disabled = on;
      btn.textContent = on ? '处理中…' : '登录';
      if (authStatus) authStatus.textContent = on ? text || '正在解锁数据…' : '';
    }

    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      if (!password) {
        setError('请输入密码');
        return;
      }
      setLoading(true, '正在连接云端…');
      clearError();
      try {
        await withTimeout(unlockOrSignIn(email, password), '解锁');
        setLoading(true, '正在加载记录本…');
        await finishLogin();
      } catch (err) {
        console.error('登录失败', err);
        showAuth();
        if (err.message === 'DECRYPT_FAILED') {
          setError('密码错误或数据已损坏，请确认使用注册时的密码');
        } else {
          setError(formatAuthError(err));
        }
      } finally {
        setLoading(false);
      }
    });

    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-password-confirm').value;
      const inviteCode = document.getElementById('register-invite-code').value;
      const babyName = document.getElementById('register-baby-name').value.trim();
      const babyGender =
        document.querySelector('input[name="register-gender"]:checked')?.value || 'boy';
      if (!normalizeInviteCode(inviteCode)) {
        setError('请填写邀请码');
        return;
      }
      if (!babyName) {
        setError('请填写宝宝昵称');
        return;
      }
      if (password.length < 8) {
        setError('密码至少 8 位');
        return;
      }
      if (password !== confirm) {
        setError('两次密码不一致');
        return;
      }
      const btn = formRegister.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await signUp(email, password, babyName, babyGender, inviteCode);
        await finishLogin();
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        btn.disabled = false;
      }
    });

    formReset?.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');
      try {
        await resetPassword(document.getElementById('reset-email').value.trim());
        setError('重置邮件已发送，请查收邮箱（若开启邮件确认）');
      } catch (err) {
        setError(err.message || '发送失败');
      }
    });

    btnLogout?.addEventListener('click', async () => {
      if (!confirm('确定退出登录？')) return;
      await signOut();
    });
  }

  async function init() {
    if (!hasConfig()) {
      showConfigError();
      return false;
    }

    supabase = initSupabase();
    if (!supabase) {
      showConfigError();
      return false;
    }

    bindAuthUI();

    if (global.BabyBookTheme) {
      global.BabyBookTheme.applyTheme('boy');
      global.BabyBookTheme.applyBranding('宝宝');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const savedPwd = sessionStorage.getItem(SESSION_PWD_KEY);
      if (savedPwd) {
        currentUser = session.user;
        try {
          await onAuthSuccess(savedPwd, false);
          await finishLogin();
          showSyncStatus('已自动登录 · 数据已从云端加载', 'ok');
          return true;
        } catch (e) {
          sessionStorage.removeItem(SESSION_PWD_KEY);
          console.warn('自动解锁失败，请重新输入密码', e);
        }
      }

      const loginEmail = document.getElementById('login-email');
      const unlockHint = document.getElementById('auth-unlock-hint');
      if (loginEmail) {
        loginEmail.value = session.user.email;
        loginEmail.readOnly = true;
      }
      if (unlockHint) unlockHint.hidden = false;
    }

    showAuth();
    return false;
  }

  global.BabyBookStore = {
    init,
    getCache,
    setCache,
    saveData,
    persistNow,
    getUser,
    getProfile: () => ({ ...userProfile }),
    isLoggedIn,
    signOut,
    showApp,
  };
})(window);
