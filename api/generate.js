// api/generate.js — Vercel 타임아웃 60초로 확장
export const maxDuration = 60; // Vercel Pro: 300, Hobby: 60

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    keyword, subKeywords = [], arrowDirectives = '',
    format = 'info', tone = 'friendly', guideline = ''
  } = req.body || {};
  if (!keyword) return res.status(400).json({ error: '키워드 없음' });

  const formatMap = {
    review: '실사용 후기 / 경험담', info: '정보글 / 노하우',
    list: '리스트업 / 추천 정리', howto: '방법 / 따라하기', compare: '비교 분석'
  };
  const toneMap = {
    friendly: '친근한 블로거 톤 (-요/-죠)',
    professional: '신뢰감 있는 전문가 톤',
    informative: '정보전달 중심, 간결하게',
    storytelling: '스토리텔링, 자연스러운 서술',
    review: '솔직한 후기 톤'
  };

  const subKwLine = subKeywords.length > 0 ? `서브 키워드: ${subKeywords.join(', ')}` : '';
  const arrowSection = arrowDirectives ? `\n[추가 지시문]\n${arrowDirectives}` : '';

  const prompt = `네이버 블로그 SEO 전문 블로거입니다. 아래 조건으로 포스팅을 작성하세요.

메인 키워드: ${keyword}
${subKwLine}
글 형식: ${formatMap[format] || format}
톤: ${toneMap[tone] || tone}
목표 글자수: 1,200~1,500자 (간결하게)
${arrowSection}

[제목] 25자 내외, 키워드 앞 배치, CTR 단어(후기·방법·추천·정리·비교) 포함
[본문] 키워드 "${keyword}" 5회, H2 소제목 3개, 문단 4줄 이내, 리스트 1개 이상
[구조] 도입→[IMAGE_THUMBNAIL]→본론①→[IMAGE_BODY1]→본론②→[IMAGE_BODY2]→본론③→마무리
[해시태그] 10~15개
${guideline ? '[추가지침] ' + guideline : ''}

JSON으로만 응답:
{"title":"제목","subTitle":"부제목","metaDescription":"요약","body":"HTML본문","hashtags":["태그"],"imageThumbnailPrompt":"영문프롬프트","imageBody1Prompt":"영문프롬프트","imageBody2Prompt":"영문프롬프트"}`;

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
        max_tokens: 3000,
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
