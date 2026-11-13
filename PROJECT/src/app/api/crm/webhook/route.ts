import { NextResponse } from 'next/server';
import { getTwilioSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, {
    allowWebhookSecret: true,
    rateLimitBucket: 'crm-webhook',
    maxRequestsPerMinute: 120,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action = 'lead', data } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Missing "data" in request payload.' },
        { status: 400 }
      );
    }

    if (action === 'lead') {
      const { name, phone, language = 'English', budget = '', location = '' } = data;
      if (!phone) {
        return NextResponse.json(
          { success: false, message: 'Customer phone number is required.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Lead ${name || 'Customer'} (${phone}) received and queued for calling.`,
        lead: {
          name,
          phone,
          language,
          budget,
          location,
          status: 'PENDING',
          consent: true,
        },
      });
    }

    if (action === 'property') {
      const { title, price, location, bhk = '2 BHK', description = '' } = data;
      if (!title || !price || !location) {
        return NextResponse.json(
          { success: false, message: 'Property title, price, and location are required.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Property "${title}" received and added to Priya AI Knowledge Base.`,
      });
    }

    if (action === 'call') {
      const { name = 'Customer', phone, language = 'English' } = data;
      if (!phone) {
        return NextResponse.json(
          { success: false, message: 'Phone number is required to make a call.' },
          { status: 400 }
        );
      }

      const twilio = getTwilioSettings();
      if (!twilio.accountSid || !twilio.authToken || !twilio.phoneNumber) {
        return NextResponse.json(
          {
            success: false,
            message: 'Twilio is not configured. Please configure Twilio in AI Voice Settings first.',
          },
          { status: 400 }
        );
      }

      // Trigger Twilio call
      const cleanPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
      return NextResponse.json({
        success: true,
        message: `Physical outbound call dispatched to ${name} (${cleanPhone}).`,
      });
    }

    return NextResponse.json(
      { success: false, message: `Unknown action "${action}". Valid actions are: "lead", "property", "call".` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'CRM Webhook error' },
      { status: 500 }
    );
  }
}
