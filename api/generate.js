// api/generate.js — 웹 검색 + AI 글 생성
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    keyword, subKeywords = [], arrowDirectives = '',
    format = 'info', tone = 'friendly', guideline = ''
  } = req.body || {};
  if (!keyword) return res.status(400).json({ error: '키워드 없음' });

  const formatMap = {
    review: '실사용 후기/경험담', info: '정보글/노하우',
    list: '리스트업/추천 정리', howto: '방법/따라하기', compare: '비교 분석'
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

  const prompt = `네이버 블로그 SEO 전문 블로거입니다.

먼저 "${keyword}"에 대해 웹 검색으로 최신 정보(현재 가격, 최근 뉴스, 트렌드)를 확인한 뒤, 그 내용을 반영해서 포스팅을 작성하세요.

메인 키워드: ${keyword}
${subKwLine}
글 형식: ${formatMap[format] || format}
톤: ${toneMap[tone] || tone}
목표 글자수: 1,200~1,500자
${arrowSection}
${guideline ? '[추가지침] ' + guideline : ''}

[제목] 25자 내외, 키워드 앞 배치, CTR 단어(후기·방법·추천·정리·비교) 포함
[본문] 키워드 "${keyword}" 5회, H2 소제목 3개, 문단 4줄 이내, 리스트 1개 이상
[중요] 검색으로 확인한 최신 수치/정보를 본문에 자연스럽게 반영
[구조] 도입→[IMAGE_THUMBNAIL]→본론①→[IMAGE_BODY1]→본론②→[IMAGE_BODY2]→본론③→마무리
[해시태그] 10~15개

JSON으로만 최종 응답:
{"title":"제목","subTitle":"부제목","metaDescription":"요약","body":"HTML본문","hashtags":["태그"],"imageThumbnailPrompt":"영문프롬프트","imageBody1Prompt":"영문프롬프트","imageBody2Prompt":"영문프롬프트"}`;

  try {
    // 1단계: 웹 검색 포함 API 호출
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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'API 오류' });

    // 2단계: tool_use 응답 처리 (웹 검색 결과 포함된 최종 텍스트 추출)
    let finalText = '';

    // stop_reason이 end_turn이면 바로 텍스트 추출
    // tool_use가 있으면 tool_result를 포함해서 재호출
    if (data.stop_reason === 'tool_use') {
      const toolUseBlock = data.content.find(b => b.type === 'tool_use');
      const toolResultMessages = [
        { role: 'user', content: prompt },
        { role: 'assistant', content: data.content },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: '웹 검색이 완료되었습니다. 검색 결과를 바탕으로 JSON 형식으로만 최종 포스팅을 작성해주세요.'
          }]
        }
      ];

      const r2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: toolResultMessages
        })
      });

      const data2 = await r2.json();
      finalText = data2.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
    } else {
      // end_turn — 바로 텍스트 추출
      finalText = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
    }

    if (!finalText) throw new Error('응답 텍스트 없음');

    // JSON 파싱
    const clean = finalText.replace(/```json\n?|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s === -1) throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(clean.slice(s, e + 1));

    res.json({ success: true, post: parsed });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
