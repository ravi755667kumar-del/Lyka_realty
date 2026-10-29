import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { leadId } = await req.json();
    return NextResponse.json({
      success: true,
      message: `Call initiated for lead ${leadId}. Launching browser AI telecaller.`,
      simulated: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Call lead error' },
      { status: 500 }
    );
  }
}
