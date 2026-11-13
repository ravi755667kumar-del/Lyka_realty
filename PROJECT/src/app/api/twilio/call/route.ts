import { NextResponse } from 'next/server';
import { getTwilioSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'twilio-call', maxRequestsPerMinute: 30 });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { leadId, name = 'Customer', phone, language = 'English' } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'A customer phone number is required to make a physical phone call.' },
        { status: 400 }
      );
    }

    const twilio = getTwilioSettings();
    if (!twilio.accountSid || !twilio.authToken || !twilio.phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message:
            'Twilio Telephony is not configured yet. Please open AI Voice Settings → Twilio and provide your Account SID, Auth Token, and Twilio Phone Number.',
        },
        { status: 400 }
      );
    }

    // Format phone number into E.164 (+1234567890)
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = `+91${cleanPhone}`; // Default to India country code for 10-digit mobile
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    // Tailor conversational TwiML speech based on customer language
    const isHindi = language.toLowerCase().includes('hindi');
    const isTamil = language.toLowerCase().includes('tamil');

    let twimlSpeech = '';
    if (isHindi) {
      twimlSpeech = `
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">
    Namaste ${escapeXml(name)} ji! Main Lyka Realty se Priya baat kar rahi hoon.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="hi-IN">
    Hum aapko Chennai aur top locations mein prime properties aur site visits ki jankari ke liye call kar rahe hain. Hamare pass aapke budget ke hisaab se shandar luxury apartments uplabdh hain. Hamari senior sales team aapse jald hi sampark karegi. Dhanyawaad!
  </Say>
</Response>`.trim();
    } else if (isTamil) {
      twimlSpeech = `
<Response>
  <Say voice="Polly.Kajal" language="en-IN">
    Vanakkam ${escapeXml(name)}! This is Priya calling from Lyka Realty.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Kajal" language="en-IN">
    Neenga Chennai-la property paarthu irundheenga. We have exclusive 2 BHK and 3 BHK gated community projects in Velachery, OMR, and Tambaram with direct site visit booking available this weekend. Our property specialist will WhatsApp you complete details shortly. Thank you!
  </Say>
</Response>`.trim();
    } else {
      twimlSpeech = `
<Response>
  <Say voice="Polly.Kajal" language="en-IN">
    Hello ${escapeXml(name)}, good day! This is Priya calling from Lyka Realty.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Kajal" language="en-IN">
    I am reaching out regarding your interest in luxury residential properties in Chennai. We have verified ready-to-move-in and under-construction developments matching your criteria. Our senior property advisor will follow up with complete floor plans. Have a great day!
  </Say>
</Response>`.trim();
    }

    // Call Twilio official REST API to initiate live outbound call
    const authHeader =
      'Basic ' +
      Buffer.from(`${twilio.accountSid.trim()}:${twilio.authToken.trim()}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', cleanPhone);
    params.append('From', twilio.phoneNumber.trim());
    params.append('Twiml', twimlSpeech);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid.trim()}/Calls.json`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const resJson = await response.json();

    if (!response.ok) {
      console.error('Twilio Outbound Call Error:', resJson);
      return NextResponse.json(
        {
          success: false,
          message: `Twilio call failed (${response.status}): ${resJson.message || 'Error initiating outbound call.'}`,
          details: resJson,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      callSid: resJson.sid,
      status: resJson.status, // 'queued' or 'ringing'
      to: cleanPhone,
      from: twilio.phoneNumber,
      message: `Physical phone call initiated successfully to ${name} (${cleanPhone})! Customer phone is ringing via Twilio PSTN.`,
    });
  } catch (error: any) {
    console.error('Twilio Call Route Exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error making physical call.' },
      { status: 500 }
    );
  }
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
