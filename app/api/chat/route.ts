import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    const responses = [
      "I can help you with that! Let me create the code for you.",
      "Great idea! I'll implement that feature right away.",
      "Sure thing! I'll add that to your project.",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return NextResponse.json({
      message: `${randomResponse}\n\n(Note: This is a demo. AI integration coming soon!)`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
