// api/generate.js — AI 블로그 글 생성 (서버사이드)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { keyword, subKeywords = [], arrowDirectives = '', format = 'info', tone = 'friendly', guideline = '' } = req.body || {};
  if (!keyword) return res.status(400).json({ error: '키워드 없음' });

  const formatMap = {
    review: '실사용 후기 / 경험담',
    info:   '정보글 / 노하우',
    list:   '리스트업 / 추천 정리',
    howto:  '방법 / 따라하기',
    compare:'비교 분석'
  };
  const toneMap = {
    friendly:      '친근한 블로거 톤 (-요/-죠/-거든요)',
    professional:  '신뢰감 있는 전문가 톤',
    informative:   '정보전달 중심, 간결하게',
    storytelling:  '스토리텔링, 자연스러운 서술',
    review:        '솔직한 후기 톤'
  };

  const subKwLine = subKeywords.length > 0
    ? `서브 키워드: ${subKeywords.join(', ')}`
    : '';
  const arrowSection = arrowDirectives
    ? `\n[추가 지시문]\n${arrowDirectives}`
    : '';

  const prompt = `당신은 네이버 블로그 SEO와 홈판(리트리버) 노출에 특화된 전문 블로거입니다.

[핵심 키워드]
메인 키워드: ${keyword}
${subKwLine}
글 형식: ${formatMap[format] || format}
톤앤매너: ${toneMap[tone] || tone}
목표 글자수: 1,700~2,000자
${arrowSection}

[제목 규칙]
- 25자 내외 (20~28자)
- 메인 키워드를 앞쪽에 배치
- CTR 단어 포함: 후기·방법·추천·정리·비교·총정리·솔직히·직접

[본문 규칙]
- 메인 키워드 "${keyword}" 정확히 5회 삽입
- H2 소제목 3개 이상
- 문단 최대 4줄 (자동광고 최적화)
- 이모티콘 최소화
- 번호/불릿 리스트 1개 이상
- AI 말투 금지, 자연스러운 블로거 문체

[글 구조]
① 도입부 (3~5줄) → [IMAGE_THUMBNAIL]
② H2 본론① → [IMAGE_BODY1]
③ H2 본론② → [IMAGE_BODY2]
④ H2 본론③
⑤ 마무리 (2~3줄)

[추가 지침]
${guideline}

[해시태그] 10~15개

반드시 JSON으로만 응답:
{
  "title": "25자 내외 제목",
  "subTitle": "15자 내외 부제목",
  "metaDescription": "80~120자 요약",
  "body": "완성된 본문 HTML (<h2><h3><p><strong><ul><ol><li> 사용, [IMAGE_THUMBNAIL][IMAGE_BODY1][IMAGE_BODY2] 포함)",
  "hashtags": ["태그1",...10~15개],
  "titleLength": 숫자,
  "imageThumbnailPrompt": "썸네일 영문 프롬프트",
  "imageBody1Prompt": "본문이미지1 영문 프롬프트",
  "imageBody2Prompt": "본문이미지2 영문 프롬프트"
}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'API 오류' });

    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json\n?|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    const parsed = JSON.parse(clean.slice(s, e + 1));

    res.json({ success: true, post: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
