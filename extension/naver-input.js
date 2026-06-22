// naver-input.js — 네이버 에디터 자동 입력 (최소화 확장프로그램)

let pendingData = null;

// 1. 저장된 대기 데이터 확인
chrome.storage.local.get(['bap_pending'], (result) => {
  const p = result.bap_pending;
  if (!p) return;
  // 5분 이내 데이터만 사용
  if (Date.now() - p.ts > 5 * 60 * 1000) {
    chrome.storage.local.remove('bap_pending');
    return;
  }
  pendingData = p;
  chrome.storage.local.remove('bap_pending');
  waitAndInsert(pendingData);
});

// 2. 실시간 메시지 수신
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'INSERT_CONTENT') {
    pendingData = msg.data;
    waitAndInsert(pendingData)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// ── 에디터 준비 대기 후 삽입 ────────────────────────────
async function waitAndInsert(data, retries = 25, interval = 800) {
  for (let i = 0; i < retries; i++) {
    if (isEditorReady()) {
      await delay(400);
      await doInsert(data);
      return;
    }
    await delay(interval);
  }
  await doInsert(data); // 타임아웃 후 강제 시도
}

function isEditorReady() {
  return !!(findTitleEl() && findBodyEl());
}

async function doInsert(data) {
  // 제목 입력
  const titleEl = findTitleEl();
  if (titleEl) {
    titleEl.focus();
    const setter = Object.getOwnPropertyDescriptor(
      titleEl.tagName === 'INPUT'
        ? window.HTMLInputElement.prototype
        : window.HTMLTextAreaElement.prototype,
      'value'
    );
    if (setter?.set) setter.set.call(titleEl, data.title || '');
    else titleEl.value = data.title || '';
    ['input','change','keyup'].forEach(ev =>
      titleEl.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  }

  await delay(600);

  // 본문 입력 — 텍스트 방식 (가장 안전)
  const bodyEl = findBodyEl();
  if (bodyEl) {
    bodyEl.focus();
    await delay(200);
    const plain = htmlToPlain(data.body || '');
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    const lines = plain.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) document.execCommand('insertText', false, line);
      if (i < lines.length - 1) document.execCommand('insertParagraph', false, null);
    }
  }

  await delay(300);

  // 예약시간 배너
  if (data.scheduleTime) showBanner(data.scheduleTime);
}

// ── 제목 요소 탐색 ──────────────────────────────────────
function findTitleEl() {
  const sels = ['.se-title-text','[placeholder="제목"]','input[placeholder*="제목"]'];
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  for (const frame of document.querySelectorAll('iframe')) {
    try {
      const doc = frame.contentDocument;
      for (const s of sels) {
        const el = doc?.querySelector(s);
        if (el) return el;
      }
    } catch(e) {}
  }
  return null;
}

// ── 본문 요소 탐색 ──────────────────────────────────────
function findBodyEl() {
  for (const frame of document.querySelectorAll('iframe')) {
    try {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const els = doc.querySelectorAll('[contenteditable="true"]');
      for (const el of els) {
        if (el.getBoundingClientRect().height > 100) return el;
      }
      if (doc.designMode === 'on') return doc.body;
    } catch(e) {}
  }
  const direct = document.querySelector('[contenteditable="true"]');
  return direct?.getBoundingClientRect().height > 100 ? direct : null;
}

// ── HTML → 일반 텍스트 ──────────────────────────────────
function htmlToPlain(html) {
  return html
    .replace(/<h[1-6][^>]*>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[IMAGE_THUMBNAIL\]/g, '\n[썸네일 이미지 삽입]\n')
    .replace(/\[IMAGE_BODY1\]/g, '\n[본문 이미지1 삽입]\n')
    .replace(/\[IMAGE_BODY2\]/g, '\n[본문 이미지2 삽입]\n')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&nbsp;/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}

// ── 예약시간 배너 ────────────────────────────────────────
function showBanner(time) {
  const id = '__bap_banner__';
  document.getElementById(id)?.remove();
  const b = document.createElement('div');
  b.id = id;
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#03C75A;color:#fff;padding:10px 20px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;font-family:"Apple SD Gothic Neo",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);';
  b.innerHTML = `<span>📅 예약 발행 시간: <strong>${time}</strong> &nbsp;|&nbsp; 예약시간 설정 후 발행 버튼을 눌러주세요</span><button onclick="this.parentNode.remove()" style="background:rgba(255,255,255,.25);border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;">닫기</button>`;
  document.body.prepend(b);
  setTimeout(() => b.parentNode && b.remove(), 15000);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// 페이지 로드 완료 신호
window.addEventListener('load', () => {
  if (pendingData) {
    delay(2000).then(() => waitAndInsert(pendingData));
  }
});
