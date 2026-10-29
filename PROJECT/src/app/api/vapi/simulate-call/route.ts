import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { leadId, scenario } = await req.json();
    return NextResponse.json({
      success: true,
      message: `Simulated call completed for scenario ${scenario}.`,
      lead: { id: leadId, outcome: scenario },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Simulate call error' },
      { status: 500 }
    );
  }
}
