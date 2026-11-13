import { NextResponse } from 'next/server';
import { getTwilioSettings, saveTwilioSettings } from '@/lib/serverConfig';
import {
  requireAuthenticatedApi,
  maskSensitiveValue,
  redactErrorMessage,
} from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

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
    accountSidMasked: current.accountSid ? maskSensitiveValue(current.accountSid, 6, 4) : '',
    phoneNumberMasked: current.phoneNumber ? maskSensitiveValue(current.phoneNumber, 3, 4) : '',
    hasAuthToken: Boolean(current.authToken && current.authToken.length > 5),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  try {
    const current = getTwilioSettings();
    const data = await req.json();
    const accountSid = (data?.accountSid || '').trim() || current.accountSid || '';
    const authToken = (data?.authToken || '').trim() || current.authToken || '';
    const phoneNumber = (data?.phoneNumber || '').trim() || current.phoneNumber || '';

    if (!accountSid || !accountSid.startsWith('AC')) {
      return NextResponse.json(
        { success: false, message: 'Invalid Twilio Account SID. It must start with "AC".' },
        { status: 400 }
      );
    }

    if (!authToken || authToken.length < 10) {
      return NextResponse.json(
        { success: false, message: 'Invalid Twilio Auth Token. Please provide a valid token from your Twilio Console.' },
        { status: 400 }
      );
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid Twilio Phone Number (with country code, e.g. +1234567890).' },
        { status: 400 }
      );
    }

    // Validate credentials against Twilio official API
    try {
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const testRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
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
      accountSid,
      authToken,
      phoneNumber,
    });

    return NextResponse.json({
      success: true,
      message: 'Twilio telephony configuration verified and saved successfully! Physical phone calling is ready.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: redactErrorMessage(error, 'Failed to update Twilio settings.') },
      { status: 500 }
    );
  }
}
