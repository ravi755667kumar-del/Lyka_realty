import assert from 'node:assert/strict';

/**
 * Normalizes phone number into E.164 (+1234567890) format
 */
function normalizeE164Phone(phone: string): string {
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = `+91${clean}`;
    } else {
      clean = `+${clean}`;
    }
  }
  return clean;
}

/**
 * Masks Twilio Account SID for security display
 */
function maskAccountSid(sid: string): string {
  const clean = sid.trim();
  if (clean.length <= 8) return 'AC••••••••';
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

/**
 * Generates TwiML speech for physical phone calls
 */
function generateTwiML(name: string, language: string): string {
  const isHindi = language.toLowerCase().includes('hindi');
  const isTamil = language.toLowerCase().includes('tamil');

  if (isHindi) {
    return `<Response><Say voice="Polly.Aditi" language="hi-IN">Namaste ${name} ji! Main Lyka Realty se Priya baat kar rahi hoon.</Say></Response>`;
  }
  if (isTamil) {
    return `<Response><Say voice="Polly.Kajal" language="en-IN">Vanakkam ${name}! This is Priya calling from Lyka Realty.</Say></Response>`;
  }
  return `<Response><Say voice="Polly.Kajal" language="en-IN">Hello ${name}, good day! This is Priya calling from Lyka Realty.</Say></Response>`;
}

export async function testTwilioAndConfig(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  // 1. Phone normalization
  run('normalizeE164Phone: formats 10-digit Indian mobile number with +91 country code', () => {
    assert.equal(normalizeE164Phone('9840123456'), '+919840123456');
    assert.equal(normalizeE164Phone('98401 23456'), '+919840123456');
    assert.equal(normalizeE164Phone('(98401) 23456'), '+919840123456');
  });

  run('normalizeE164Phone: preserves international numbers with existing + prefix', () => {
    assert.equal(normalizeE164Phone('+971501234567'), '+971501234567'); // Dubai/UAE
    assert.equal(normalizeE164Phone('+14155552671'), '+14155552671');   // USA
  });

  // 2. Account SID masking
  run('maskAccountSid: masks middle characters while preserving AC prefix and last 4 characters', () => {
    const sid = 'AC1234567890abcdef1234567890abcdef';
    const masked = maskAccountSid(sid);
    assert.ok(masked.startsWith('AC12'));
    assert.ok(masked.includes('••••••••'));
    assert.ok(masked.endsWith('cdef'));
  });

  // 3. Multilingual TwiML generation
  run('generateTwiML: generates Hindi greeting with Polly.Aditi voice for Hindi language', () => {
    const twiml = generateTwiML('Rahul', 'Hindi');
    assert.ok(twiml.includes('Namaste Rahul ji!'));
    assert.ok(twiml.includes('Polly.Aditi'));
    assert.ok(twiml.includes('hi-IN'));
  });

  run('generateTwiML: generates Tamil/Tanglish greeting with Vanakkam for Tamil language', () => {
    const twiml = generateTwiML('Karthik', 'Tamil');
    assert.ok(twiml.includes('Vanakkam Karthik!'));
    assert.ok(twiml.includes('Polly.Kajal'));
  });

  run('generateTwiML: generates professional English greeting for English language', () => {
    const twiml = generateTwiML('Alexander', 'English');
    assert.ok(twiml.includes('Hello Alexander, good day!'));
    assert.ok(twiml.includes('Polly.Kajal'));
  });

  return results;
}
