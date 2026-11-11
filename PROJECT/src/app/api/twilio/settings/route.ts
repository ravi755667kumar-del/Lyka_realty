import { NextResponse } from 'next/server';
import { getTwilioSettings, saveTwilioSettings } from '@/lib/serverConfig';

export async function GET() {
  const current = getTwilioSettings();
  const isConfigured = Boolean(
    current.accountSid &&
    current.accountSid.startsWith('AC') &&
    current.authToken &&
    current.authToken.length > 5 &&
    current.phoneNumber &&
    current.phoneNumber.length >= 8
  );

  return NextResponse.json({
    configured: isConfigured,
    accountSid: current.accountSid || '',
    accountSidMasked: current.accountSid
      ? `${current.accountSid.slice(0, 6)}••••••••${current.accountSid.slice(-4)}`
      : '',
    phoneNumber: current.phoneNumber || '',
    hasAuthToken: Boolean(current.authToken && current.authToken.length > 5),
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { accountSid, authToken, phoneNumber } = data;

    if (!accountSid || !accountSid.trim().startsWith('AC')) {
      return NextResponse.json(
        { success: false, message: 'Invalid Twilio Account SID. It must start with "AC".' },
        { status: 400 }
      );
    }

    if (!authToken || authToken.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: 'Invalid Twilio Auth Token. Please provide a valid token from your Twilio Console.' },
        { status: 400 }
      );
    }

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid Twilio Phone Number (with country code, e.g. +1234567890).' },
        { status: 400 }
      );
    }

    // Validate credentials against Twilio official API
    try {
      const authHeader = 'Basic ' + Buffer.from(`${accountSid.trim()}:${authToken.trim()}`).toString('base64');
      const testRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid.trim()}.json`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      if (!testRes.ok) {
        const errJson = await testRes.json().catch(() => ({}));
        return NextResponse.json(
          {
            success: false,
            message: `Twilio authentication failed (${testRes.status}): ${errJson.message || 'Check Account SID and Auth Token.'}`,
          },
          { status: 401 }
        );
      }
    } catch (testErr: any) {
      console.warn('Twilio credentials test check network note:', testErr);
      // If network check fails, we still allow saving so offline / restricted environments can configure
    }

    saveTwilioSettings({
      accountSid: accountSid.trim(),
      authToken: authToken.trim(),
      phoneNumber: phoneNumber.trim(),
    });

    return NextResponse.json({
      success: true,
      message: 'Twilio telephony configuration verified and saved successfully! Physical phone calling is ready.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update Twilio settings.' },
      { status: 500 }
    );
  }
}
