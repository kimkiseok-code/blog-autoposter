// api/suggest.js — 키워드 자동추천
export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { keyword } = req.body || {};
  if (!keyword) return res.status(400).json({ error: '키워드 없음' });

  const prompt = `네이버 블로그 SEO 전문가입니다.
메인 키워드: "${keyword}"

JSON으로만 응답:
{
  "subKeywords": ["연관키워드1","연관키워드2","연관키워드3","연관키워드4","연관키워드5"],
  "directives": ["독자층 대상 작성","도입부 방향","핵심내용 포함","구체적 팁 제공","마무리 방향"],
  "format": "review 또는 info 또는 list 또는 howto 또는 compare 중 1개"
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json\n?|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    const parsed = JSON.parse(clean.slice(s, e + 1));

    res.json({ success: true, ...parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
