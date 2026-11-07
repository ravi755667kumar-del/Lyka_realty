import { NextResponse } from 'next/server';
import { getOpenAISettings } from '@/lib/serverConfig';
import { queryBestPDFAnswer } from '@/lib/neon';

function getOpenAISystemPrompt(
  agentName = 'Priya',
  agentGender = 'female',
  customerEmotion = 'neutral',
  language = ''
) {
  const isMale = agentGender === 'male';
  let roleDesc = isMale
    ? `You are ${agentName}, an energetic, friendly male property advisor from Lyka Realty on a live phone call.`
    : `You are ${agentName}, a young, cheerful, fast-talking, natural Indian female telecaller from Lyka Realty. You speak with lively energy, friendly warmth, and brisk confidence.`;

  if (language === 'Tamil-English' || language === 'Tamil') {
    roleDesc = `Neenga Priya, Lyka Realty-oda AI virtual property assistant. Friendly-aa, patient-aa, humble-aa pesanum.

BRISK PHONE CALL SPEED (FAST TURNAROUND UNDER 2 SECONDS):
- Neenga live phone call-la pesureenga. Brisk-aa, energetic-aa, fast telecaller mathiri pesanum.
- Strictly 1 to 2 short sentences mattum dhaan pesanum (maximum 15 to 20 words). Adhukku mela vala-vala-nu pesa koodaadhu.
- Direct & punchy: Customer kettadha first sentence-laye direct-aa answer pannunga. Oru fact + oru chinna follow-up question.

CRITICAL PRIORITY: ALWAYS ANSWER THE CALLER'S QUESTION DIRECTLY FIRST!
If the customer asks ANY question (pricing, rate, location, flat availability, whether you are AI, why you called, loan, brochure, etc.), you MUST answer their question directly, immediately, and accurately using verified facts. NEVER ignore what the caller asked to push a scripted question! Only after answering their question directly may you ask a natural, polite follow-up.

STRICT PDF SPECIFICATION (VERIFIED CHENNAI & DUBAI PROPERTIES):
- Velachery: 2BHK 950 sq ft ready-to-move flat for Rs. 72 Lakhs, lift & 2 car parking.
- OMR Sholinganallur: 3BHK 1450 sq ft luxury flat with gym & swimming pool for Rs. 1.25 Crore.
- Chengalpattu: 1200 sq ft DTCP approved plot for Rs. 18 Lakhs with bank loan support.
- Tambaram: 3BHK individual house 1800 sq ft, East facing for Rs. 1.6 Crore.
- Porur: 1BHK rental flat for Rs. 14,000/month.
- Adyar: 2BHK rental flat for Rs. 28,000/month.`;
  }

  return roleDesc;
}

export async function POST(req: Request) {
  const settings = getOpenAISettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'OpenAI API key (OPENAI_API_KEY / openai_key) is not configured.' },
      { status: 503 }
    );
  }

  try {
    const {
      messages,
      model,
      leadName = '',
      language = '',
      agentName = 'Priya',
      agentGender = 'female',
      customerEmotion = 'neutral',
      temperature = 0.5,
    } = await req.json();

    const activeModel = model || settings.chatModel || 'gpt-4o-mini';
    const basePrompt = getOpenAISystemPrompt(agentName, agentGender, customerEmotion, language);

    const formattedMessages: any[] = [];
    const personalizedSystem = leadName
      ? `${basePrompt}\nNote: Customer name is ${leadName}. Use their name sparingly, only when it sounds natural.`
      : basePrompt;

    formattedMessages.push({ role: 'system', content: personalizedSystem });

    // Neon RAG lookup for real-time PDF knowledge
    const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === 'user' || m.speaker === 'Customer')?.content || '';
    if (lastUserMsg) {
      try {
        const bestKnowledge = await queryBestPDFAnswer(lastUserMsg, language);
        if (bestKnowledge) {
          formattedMessages.push({
            role: 'system',
            content: `VERIFIED DATASET MATCH FROM DATABASE:\n${bestKnowledge}\n\nGUIDANCE:\n- Pick ONLY the 1 single most relevant fact that directly answers what the customer asked.\n- Answer in 1 or 2 quick, conversational sentences (strictly under 25 words).`,
          });
        }
      } catch (e) {
        console.warn('[OpenAI Chat] queryBestPDFAnswer warning:', e);
      }
    }

    for (const msg of messages || []) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' || msg.speaker === 'AI' ? 'assistant' : 'user';
      const content = typeof msg.content === 'string' ? msg.content : msg.text || '';
      if (content.trim()) {
        formattedMessages.push({ role, content });
      }
    }

    if (formattedMessages.length <= 1) {
      formattedMessages.push({ role: 'user', content: 'Hello' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: formattedMessages,
        temperature: Math.min(1.0, Math.max(0, Number(temperature) || 0.5)),
        max_tokens: 100, // Short sub-2s response
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, message: `OpenAI Chat error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      text: replyText.trim(),
      reply: replyText.trim(),
      model: activeModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'OpenAI Chat request failed.' },
      { status: 500 }
    );
  }
}
