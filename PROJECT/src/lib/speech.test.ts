import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectCustomerEmotion,
  getDefaultTtsForBrain,
  getSarvamSpeaker,
  getSarvamTtsParameters,
  isSarvamV3Speaker,
  prepareSpeech,
  refineForSpeech,
  selectSpeechProvider,
} from './speech';

test('speech preparation turns separate written lines into natural spoken sentences', () => {
  assert.equal(refineForSpeech('First point\nSecond point'), 'First point. Second point.');
});

test('speech preparation strips formatting without changing the user-visible response', () => {
  const response = '**The 2BHK is ready to move in.**\nIt is near the MRT station.';
  const prepared = prepareSpeech(response, { language: 'English' });

  assert.equal(prepared.text, 'The 2 B-H-K is ready to move in. It is near the M-R-T station.');
  assert.equal(prepared.language, 'English');
  assert.equal(prepared.emotion, 'neutral');
});

test('speech preparation carries Hindi and Tamil-English context separately from spoken text', () => {
  const hindi = prepareSpeech('Haan, I can explain that.', { language: 'Hinglish', emotion: 'positive' });
  const tanglish = prepareSpeech('Seri, I can explain that.', { language: 'Tamil-English', emotion: 'angry' });

  assert.equal(hindi.language, 'Hindi');
  assert.equal(hindi.languageCode, 'hi-IN');
  assert.equal(hindi.isCodeMixed, true);
  assert.equal(hindi.delivery.style, 0.3);
  assert.equal(tanglish.language, 'Tamil-English');
  assert.equal(tanglish.languageCode, 'ta-IN');
  assert.equal(tanglish.isCodeMixed, true);
  assert.equal(tanglish.delivery.pace, 1.0);
  assert.doesNotMatch(tanglish.text, /angry|emotion|metadata/i);
});

test('speech preparation turns explicit positive delivery cues into upbeat voice settings', () => {
  const excited = prepareSpeech('[excited] That sounds like a great fit!', { language: 'English' });
  const happy = prepareSpeech('[happy] I can help you with that.', { language: 'English' });
  const subdued = prepareSpeech('[excited] I hear that you are upset.', {
    language: 'English',
    emotion: 'angry',
  });

  assert.equal(excited.emotion, 'positive');
  assert.equal(excited.delivery.style, 0.3);
  assert.equal(happy.emotion, 'positive');
  assert.equal(subdued.emotion, 'angry');
  assert.equal(excited.delivery.sarvamTemperature, 0.82);
  assert.equal(prepareSpeech('[warm] Welcome to Lyka Realty.').delivery.sarvamTemperature, 0.78);
  assert.equal(prepareSpeech('[empathetic] I understand.').delivery.sarvamTemperature, 0.65);
  assert.equal(subdued.delivery.sarvamTemperature, 0.55);
  assert.doesNotMatch(excited.text, /excited|happy/i);
});

test('Sarvam delivery settings stay within the Bulbul v3 pace and temperature ranges', () => {
  const delivery = prepareSpeech('Let me help you.', { language: 'English' }).delivery;

  assert.deepEqual(getSarvamTtsParameters(delivery), { pace: 1.08, temperature: 0.78 });
  assert.deepEqual(getSarvamTtsParameters(delivery, { pace: 3, temperature: 1.5 }), {
    pace: 2,
    temperature: 1,
  });
  assert.deepEqual(getSarvamTtsParameters(delivery, { pace: 0, temperature: Number.NaN }), {
    pace: 0.5,
    temperature: 0.78,
  });
});

test('Sarvam speaker selection uses supported voices and preserves language and gender', () => {
  assert.equal(isSarvamV3Speaker('priya'), true);
  assert.equal(isSarvamV3Speaker('pavithra'), false);
  assert.equal(getSarvamSpeaker('English', 'female', 'shreya'), 'shreya');
  assert.equal(getSarvamSpeaker('English', 'male', 'priya'), 'ashutosh');
  assert.equal(getSarvamSpeaker('Hindi', 'female', 'shreya'), 'shreya');
  assert.equal(getSarvamSpeaker('Tamil-English', 'male', 'anand'), 'anand');
  assert.equal(getSarvamSpeaker('Tamil-English', 'female'), 'kavitha');
  assert.equal(getSarvamSpeaker('Tamil-English', 'female', 'shreya'), 'kavitha');
  assert.equal(getSarvamSpeaker('Tamil-English', 'male'), 'gokul');
});

test('Tamil and Tanglish speech refinement produces authentic spoken Tamil', () => {
  const tanglish = prepareSpeech('Vanakkam! Naan Lyka Reality-la irundhu pesaren. Ippo 2 nimisham pesalam-a?', {
    language: 'Tamil-English',
  });
  assert.equal(tanglish.language, 'Tamil-English');
  assert.equal(tanglish.languageCode, 'ta-IN');
  assert.match(tanglish.text, /pesalaama/);
  assert.doesNotMatch(tanglish.text, /pesalam-a/);
});

test('auto provider selection prefers available AI voices when configured', () => {
  assert.equal(
    selectSpeechProvider('Tamil-English', { gemini: true }),
    'gemini'
  );
  assert.equal(
    selectSpeechProvider('English', { groq: true, gemini: true }),
    'groq'
  );
  assert.equal(selectSpeechProvider('Hindi', {}), 'browser');
});

test('choosing a reasoning provider selects its own speaking voice by default', () => {
  assert.equal(getDefaultTtsForBrain('groq'), 'groq');
  assert.equal(getDefaultTtsForBrain('gemini'), 'gemini');
  assert.equal(getDefaultTtsForBrain('rules'), 'browser');
});

test('detectCustomerEmotion detects emotional states accurately across languages', () => {
  // 1. Sadness & Grief
  assert.equal(detectCustomerEmotion('My father passed away last week, we are in grief'), 'sad');
  assert.equal(detectCustomerEmotion('Hospital-la admit panni irukkom, romba kashtama irukku'), 'sad');
  assert.equal(detectCustomerEmotion('Dehaant ho gaya family me, abhi baat nahi kar sakta'), 'sad');

  // 2. Anger & Frustration
  assert.equal(detectCustomerEmotion('This is complete fraud and scam! Stop calling me!'), 'angry');
  assert.equal(detectCustomerEmotion('Eppovum call panni irritate panreenga, waste of time'), 'angry');
  assert.equal(detectCustomerEmotion('Bakwas company hai, dimag kharab mat karo'), 'angry');

  // 3. Refusal & Busy
  assert.equal(detectCustomerEmotion('Not interested, please remove my number'), 'refusal');
  assert.equal(detectCustomerEmotion('Ippo vandi ottren, driving la irukken, aprom pesuren'), 'refusal');
  assert.equal(detectCustomerEmotion('Abhi meeting me hoon, call mat karo'), 'refusal');

  // 4. Amusement & Humour
  assert.equal(detectCustomerEmotion('Haha you are very funny, just kidding!'), 'amused');
  assert.equal(detectCustomerEmotion('Sema joke haha! Comedy pandreengala'), 'amused');

  // 5. Excitement & Positive
  assert.equal(detectCustomerEmotion('Awesome! Finally our home loan got approved!'), 'positive');
  assert.equal(detectCustomerEmotion('Super Sir! Romba sandhosham, dream home kedaichirukku'), 'positive');
  assert.equal(detectCustomerEmotion('Bahut badiya! Congratulations to your team'), 'positive');

  // 6. Curious & Complex Questioning
  assert.equal(detectCustomerEmotion('Can you explain the difference between CMDA and DTCP approvals?'), 'curious');
  assert.equal(detectCustomerEmotion('How much emi will I have to pay if I take 15 years tenure?'), 'curious');

  // 7. Neutral default
  assert.equal(detectCustomerEmotion('What is the price of the 2BHK flat in Velachery?'), 'neutral');
});

test('refineForSpeech converts [laughing] to subtle natural laughter and strips tags cleanly', () => {
  const spoken = refineForSpeech('[laughing] That is really true, Sir! [break] We have great options.');
  assert.match(spoken, /^Ha ha, That is really true, Sir,/);
  assert.doesNotMatch(spoken, /\[laughing\]/i);
  assert.doesNotMatch(spoken, /\[break\]/i);

  const clean = refineForSpeech('[excited] [warm] Welcome to Lyka Realty [softly] for your dream home.');
  assert.equal(clean, 'Welcome to Lyka Realty for your dream home.');
});

test('getSpeechDelivery modulates acoustic parameters according to the 7 emotional pillars', () => {
  // Amused / Laughter: lively tempo and higher temperature
  const amused = prepareSpeech('[laughing] Ha ha that was funny!', { language: 'English' }).delivery;
  assert.equal(amused.pace, 1.10);
  assert.equal(amused.sarvamTemperature, 0.85);

  // Sadness / Empathy: gentle, softer, caring pace
  const sad = prepareSpeech('I am so sorry for your loss, please take care.', {
    language: 'English',
    emotion: 'sad',
  }).delivery;
  assert.equal(sad.pace, 0.98);
  assert.equal(sad.loudness, 0.95);
  assert.equal(sad.sarvamTemperature, 0.55);

  // Curious / Explaining: thoughtful, clear explanatory pace
  const curious = prepareSpeech('[explaining] Let me explain how the bank loan process works.', {
    language: 'English',
  }).delivery;
  assert.equal(curious.pace, 1.04);
  assert.equal(curious.sarvamTemperature, 0.72);
});
