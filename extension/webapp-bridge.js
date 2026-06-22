// webapp-bridge.js
// 웹앱(Vercel)에서 window.postMessage를 받아 네이버 탭에 전달

window.addEventListener('message', (e) => {
  if (e.data?.type !== 'BAP_INSERT_TO_NAVER') return;

  const { naverId, title, body, scheduleTime } = e.data;

  // 네이버 글쓰기 탭이 이미 열려있으면 전달, 없으면 저장해두기
  chrome.storage.local.set({
    bap_pending: { title, body, scheduleTime, ts: Date.now() }
  });

  // 탭 찾기
  chrome.runtime.sendMessage({
    type: 'FIND_AND_INSERT',
    data: { title, body, scheduleTime }
  });
});
