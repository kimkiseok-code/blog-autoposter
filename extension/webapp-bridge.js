// webapp-bridge.js
// 웹앱에서 window.postMessage를 받아 chrome.storage에 저장
// naver-input.js가 네이버 탭 로드 시 storage에서 읽어서 입력

window.addEventListener('message', (e) => {
  if (e.data?.type !== 'BAP_INSERT_TO_NAVER') return;

  const { title, body, scheduleTime } = e.data;

  // chrome.storage.local에 저장 (5분 유효)
  chrome.storage.local.set({
    bap_pending: {
      title: title || '',
      body:  body  || '',
      scheduleTime: scheduleTime || null,
      ts: Date.now()
    }
  }, () => {
    console.log('[BAP] 발행 데이터 저장 완료:', title?.slice(0,20));
  });
});
