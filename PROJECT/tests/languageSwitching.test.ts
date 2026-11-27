import assert from 'node:assert/strict';
import {
  detectExplicitLanguageSwitch,
  detectUserConversationLanguage,
  getKnowledgeLanguageDirective,
  getLanguageScopedStyleSection,
  getLanguageSwitchOverridePrompt,
  mapSttDetectedLanguageToConversationLanguage,
  normalizeConversationLanguage,
  prepareSpeech,
  resolveCloudSttLanguageParam,
  resolveServerConversationLanguage,
  resolveSttConversationLanguage,
  resolveTtsEngineForLanguage,
} from '../src/lib/speech';

export async function testLanguageSwitching(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  run('detectExplicitLanguageSwitch: handles direct English, Hindi, and Tamil requests across scripts', () => {
    assert.equal(detectExplicitLanguageSwitch('Speak in English'), 'English');
    assert.equal(detectExplicitLanguageSwitch('Pure English please'), 'English');
    assert.equal(detectExplicitLanguageSwitch('Hindi me baat karo'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('हिंदी में बोलो'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('ஹிந்தில பேசுங்க'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('இங்கிலீஷ்ல பேசுங்க'), 'English');
    assert.equal(detectExplicitLanguageSwitch('Tamil la pesunga'), 'Tamil-English');
    assert.equal(detectExplicitLanguageSwitch('தமிழ்'), 'Tamil-English');

    // Common STT / phonetic misrecognitions for "Hindi"
    assert.equal(detectExplicitLanguageSwitch('talk in hidni'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('speak in hidni'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('talk in hindhi'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('talk in indhi'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('not hidni'), null);
  });

  run('detectExplicitLanguageSwitch: respects negative guards and clause overrides', () => {
    assert.equal(detectExplicitLanguageSwitch('not hindi'), null);
    assert.equal(detectExplicitLanguageSwitch('hindi nahi aati'), null);
    assert.equal(detectExplicitLanguageSwitch("don't speak english"), null);
    assert.equal(detectExplicitLanguageSwitch('tamil vendam'), null);

    // Negated language followed by requested target language
    assert.equal(detectExplicitLanguageSwitch('not hindi, speak in english'), 'English');
    assert.equal(detectExplicitLanguageSwitch("don't speak tamil, speak in english"), 'English');
    assert.equal(detectExplicitLanguageSwitch('english vendam, tamil la pesunga'), 'Tamil-English');

    // Geographical location "Tamil Nadu" must NOT trigger a language switch
    assert.equal(detectExplicitLanguageSwitch('I want to buy a flat in Tamil Nadu'), null);
    assert.equal(detectExplicitLanguageSwitch('Tell me about Tamil Nadu'), null);
  });

  run('detectUserConversationLanguage: switches dynamically from Tamil-English to Hindi or Hinglish', () => {
    const devanagari = detectUserConversationLanguage('मुझे वेलाचेरी में 2 BHK फ्लैट चाहिए', 'Tamil-English');
    assert.equal(devanagari.language, 'Hindi');
    assert.equal(devanagari.switched, true);
    assert.equal(devanagari.reason, 'hindi-script');

    const hinglish = detectUserConversationLanguage('Mujhe Velachery me 2 bhk flat chahiye, rate kitna hai?', 'Tamil-English');
    assert.equal(hinglish.language, 'Hindi');
    assert.equal(hinglish.switched, true);
    assert.equal(hinglish.reason, 'hindi-detected');

    const hindiFromEnglish = detectUserConversationLanguage('Haan ji, main dekhna chahta hoon', 'English');
    assert.equal(hindiFromEnglish.language, 'Hindi');
    assert.equal(hindiFromEnglish.switched, true);
  });

  run('detectUserConversationLanguage: switches dynamically on full English sentence, stays Tamil on Tamil/neutral answers', () => {
    const englishFromTamil = detectUserConversationLanguage(
      'I want to buy a house in Velachery',
      'Tamil-English'
    );
    assert.equal(englishFromTamil.language, 'English');
    assert.equal(englishFromTamil.switched, true);
    assert.equal(englishFromTamil.reason, 'english-detected');

    // Once user answers back in Tamil, switches back to Tamil-English
    const backToTamil = detectUserConversationLanguage(
      'Illanga, enaku Tambaram-la veedu venum',
      'English'
    );
    assert.equal(backToTamil.language, 'Tamil-English');
    assert.equal(backToTamil.switched, true);

    const englishQuestion = detectUserConversationLanguage(
      'Could you tell me the total price and possession date?',
      'Hindi'
    );
    assert.equal(englishQuestion.language, 'English');
    assert.equal(englishQuestion.switched, true);

    const englishContraction = detectUserConversationLanguage(
      "Sorry, I'm a bit busy right now, what is this call about?",
      'Tamil-English'
    );
    assert.equal(englishContraction.language, 'English');
    assert.equal(englishContraction.switched, true);

    const tamilNaduInEnglish = detectUserConversationLanguage(
      'I want to buy an apartment in Tamil Nadu',
      'Tamil-English'
    );
    assert.equal(tamilNaduInEnglish.language, 'English');
    assert.equal(tamilNaduInEnglish.switched, true);
  });

  run('detectUserConversationLanguage: keeps Hinglish as Hindi and Tanglish as Tamil-English even with English nouns', () => {
    const hinglishMixed = detectUserConversationLanguage(
      'Price aur site visit ke baare me batao please',
      'English'
    );
    assert.equal(hinglishMixed.language, 'Hindi');
    assert.equal(hinglishMixed.switched, true);

    const tanglishMixed = detectUserConversationLanguage(
      'Illanga, ennaku Velachery-la ready to move 2 BHK venum, rent evlo?',
      'English'
    );
    assert.equal(tanglishMixed.language, 'Tamil-English');
    assert.equal(tanglishMixed.switched, true);

    const tamilScript = detectUserConversationLanguage('எனக்கு 2 பிஎச்கே வீடு வேண்டும்', 'English');
    assert.equal(tamilScript.language, 'Tamil-English');
    assert.equal(tamilScript.switched, true);
    assert.equal(tamilScript.reason, 'tamil-script');
  });

  run('detectUserConversationLanguage: short neutral property answers preserve active language', () => {
    const shortAnswers = [
      'Velachery',
      'Anna Nagar',
      '2 BHK apartment',
      '60 lakhs',
      'Bank loan',
      'Ready to move',
      'Tomorrow morning',
      'Yes',
      'Okay',
      'Thank you',
    ];

    for (const answer of shortAnswers) {
      const keepTamil = detectUserConversationLanguage(answer, 'Tamil-English');
      assert.equal(keepTamil.language, 'Tamil-English', `Expected Tamil-English for "${answer}"`);
      assert.equal(keepTamil.switched, false);

      const keepHindi = detectUserConversationLanguage(answer, 'Hindi');
      assert.equal(keepHindi.language, 'Hindi', `Expected Hindi for "${answer}"`);
      assert.equal(keepHindi.switched, false);

      const keepEnglish = detectUserConversationLanguage(answer, 'English');
      assert.equal(keepEnglish.language, 'English', `Expected English for "${answer}"`);
      assert.equal(keepEnglish.switched, false);
    }
  });

  run('prompt & speech isolation: pure English mode contains zero Tanglish or Hindi filler leakage', () => {
    assert.equal(normalizeConversationLanguage('en-US'), 'English');
    assert.equal(normalizeConversationLanguage('hi-IN'), 'Hindi');
    assert.equal(normalizeConversationLanguage('Tamil-English'), 'Tamil-English');

    const englishStyle = getLanguageScopedStyleSection('English');
    const englishKnowledgeRule = getKnowledgeLanguageDirective('English');
    for (const leakedToken of ['Aan', 'Puriyudhu', 'Seri', 'Haan', 'Kandippa', 'panniten', 'சார்']) {
      assert.equal(englishStyle.includes(leakedToken), false, `Found "${leakedToken}" in English style prompt`);
      assert.equal(englishKnowledgeRule.includes(leakedToken), false, `Found "${leakedToken}" in English knowledge directive`);
    }

    const hindiStyle = getLanguageScopedStyleSection('Hindi');
    assert.equal(hindiStyle.includes('panniten'), false);
    assert.equal(hindiStyle.includes('Puriyudhu'), false);

    const preparedEnglish = prepareSpeech(
      '[warm] Got it! We have a 2 BHK flat in Velachery starting from 65 lakhs. Would you like to visit tomorrow?',
      { language: 'English', emotion: 'positive' }
    );
    assert.equal(preparedEnglish.language, 'English');
    assert.equal(preparedEnglish.languageCode, 'en-IN');
    assert.equal(preparedEnglish.isCodeMixed, false);
    assert.equal(/puriyudhu|kandippa|aan|haan|seri/i.test(preparedEnglish.text), false);
  });

  run('resolveTtsEngineForLanguage: redirects Hindi & Tamil-English off English-only TTS engines', () => {
    assert.equal(
      resolveTtsEngineForLanguage('groq', 'Hindi', { geminiAvailable: true, openaiAvailable: true }),
      'gemini'
    );
    assert.equal(
      resolveTtsEngineForLanguage('deepgram', 'Hindi', { geminiAvailable: false, openaiAvailable: true }),
      'openai'
    );
    assert.equal(
      resolveTtsEngineForLanguage('groq', 'Hindi', { geminiAvailable: false, openaiAvailable: false }),
      'browser'
    );
    assert.equal(
      resolveTtsEngineForLanguage('groq', 'Tamil-English', { geminiAvailable: true, openaiAvailable: true }),
      'gemini'
    );

    // English-only routes remain intact for English
    assert.equal(
      resolveTtsEngineForLanguage('groq', 'English', { geminiAvailable: true, openaiAvailable: true }),
      'groq'
    );
    assert.equal(
      resolveTtsEngineForLanguage('deepgram', 'English', { geminiAvailable: true, openaiAvailable: true }),
      'deepgram'
    );

    // Multilingual / Indic engines remain unchanged for Hindi
    assert.equal(
      resolveTtsEngineForLanguage('cartesia', 'Hindi', { geminiAvailable: true, openaiAvailable: true }),
      'cartesia'
    );
    assert.equal(
      resolveTtsEngineForLanguage('sarvam', 'Hindi', { geminiAvailable: true, openaiAvailable: true }),
      'sarvam'
    );
    assert.equal(
      resolveTtsEngineForLanguage('gemini', 'Hindi', { geminiAvailable: true, openaiAvailable: true }),
      'gemini'
    );
  });

  run('mapSttDetectedLanguageToConversationLanguage: maps Groq Whisper / ISO tags cleanly', () => {
    assert.equal(mapSttDetectedLanguageToConversationLanguage('tamil'), 'Tamil-English');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('ta-IN'), 'Tamil-English');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('hindi'), 'Hindi');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('hi'), 'Hindi');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('english'), 'English');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('en-US'), 'English');
    assert.equal(mapSttDetectedLanguageToConversationLanguage('auto'), null);
    assert.equal(mapSttDetectedLanguageToConversationLanguage('french'), null);
  });

  run('resolveSttConversationLanguage: auto-detects first turn and mid-call switches while preserving neutral answers', () => {
    // First-turn Groq Whisper auto-detect across Tamil, Hindi, English
    const firstTamil = resolveSttConversationLanguage({
      transcript: 'எனக்கு வேளச்சேரியில் வீடு चाहिए',
      sttDetectedLanguage: 'tamil',
      currentLanguage: 'English',
    });
    assert.equal(firstTamil.language, 'Tamil-English');

    const tamilUnicodeFirst = resolveSttConversationLanguage({
      transcript: 'எனக்கு வேளச்சேரியில் வீடு வேண்டும்',
      sttDetectedLanguage: 'tamil',
      currentLanguage: 'English',
    });
    assert.equal(tamilUnicodeFirst.language, 'Tamil-English');
    assert.equal(tamilUnicodeFirst.switched, true);

    const hindiFirst = resolveSttConversationLanguage({
      transcript: 'मुझे वेलाचेरी में फ्लैट चाहिए',
      sttDetectedLanguage: 'hindi',
      currentLanguage: 'Tamil-English',
    });
    assert.equal(hindiFirst.language, 'Hindi');
    assert.equal(hindiFirst.switched, true);
    assert.equal(hindiFirst.reason, 'hindi-script');

    const englishFullSentence = resolveSttConversationLanguage({
      transcript: 'Hello I am looking for a two bedroom apartment',
      sttDetectedLanguage: 'english',
      currentLanguage: 'Tamil-English',
    });
    assert.equal(englishFullSentence.language, 'English');
    assert.equal(englishFullSentence.switched, true);
    assert.equal(englishFullSentence.reason, 'english-detected');

    // Short 2-word fragments preserve Tamil-English even if STT tagged english
    const shortFragmentPreservesTamil = resolveSttConversationLanguage({
      transcript: 'My budget',
      sttDetectedLanguage: 'english',
      currentLanguage: 'Tamil-English',
    });
    assert.equal(shortFragmentPreservesTamil.language, 'Tamil-English');
    assert.equal(shortFragmentPreservesTamil.switched, false);

    // Mid-call switch Hindi -> English and Tamil -> Hindi via Whisper acoustic tag
    const romanHindiTagged = resolveSttConversationLanguage({
      transcript: 'Velachery mein ek flat chahiye',
      sttDetectedLanguage: 'hindi',
      currentLanguage: 'Tamil-English',
    });
    assert.equal(romanHindiTagged.language, 'Hindi');
    assert.equal(romanHindiTagged.switched, true);

    // Hinglish accidentally tagged 'english' by Whisper stays Hindi
    const hinglishMisTagged = resolveSttConversationLanguage({
      transcript: 'Haanji mujhe flat chahiye',
      sttDetectedLanguage: 'english',
      currentLanguage: 'Hindi',
    });
    assert.equal(hinglishMisTagged.language, 'Hindi');
    assert.equal(hinglishMisTagged.switched, false);

    // Neutral short property answers & greetings must preserve active language even when tagged 'english'
    for (const neutral of ['Velachery', '2 BHK apartment', 'Ready to move', '60 lakhs', 'Yes', 'Thank you', 'Okay sir']) {
      const keepHindi = resolveSttConversationLanguage({
        transcript: neutral,
        sttDetectedLanguage: 'english',
        currentLanguage: 'Hindi',
      });
      assert.equal(keepHindi.language, 'Hindi', `Expected Hindi preserved for "${neutral}"`);
      assert.equal(keepHindi.switched, false);

      const keepTamil = resolveSttConversationLanguage({
        transcript: neutral,
        sttDetectedLanguage: 'english',
        currentLanguage: 'Tamil-English',
      });
      assert.equal(keepTamil.language, 'Tamil-English', `Expected Tamil-English preserved for "${neutral}"`);
      assert.equal(keepTamil.switched, false);
    }

    // Explicit switches still win even if STT tagged a different language
    const explicitWin = resolveSttConversationLanguage({
      transcript: 'talk in hidni',
      sttDetectedLanguage: 'english',
      currentLanguage: 'Tamil-English',
    });
    assert.equal(explicitWin.language, 'Hindi');
    assert.equal(explicitWin.reason, 'explicit');
  });

  run('detectExplicitLanguageSwitch & resolveServerConversationLanguage: never miss real-world Hindi switch requests', () => {
    const hindiRequests = [
      'talk in hindi',
      'i tell her to talk in hindi',
      'start with hindi',
      'talk with hindi',
      'hindi main baat karo',
      'hindi may bolo',
      'hindi please',
      'only hindi',
      'talk in indie',
      'in indi please',
      'டாக் இன் ஹிந்தி',
      'ஹிந்தில பேசு',
      'இந்தில பேசு',
      'ஹிந்தி',
    ];
    for (const phrase of hindiRequests) {
      assert.equal(
        detectExplicitLanguageSwitch(phrase),
        'Hindi',
        `Expected Hindi explicit switch for "${phrase}"`
      );
    }

    const nonSwitches = [
      'Properties in India are growing',
      'not in hindi',
      'hindi nahi aati',
      'I want to buy a flat in Tamil Nadu',
      'ஹிந்தி வேண்டாம்',
      'இந்தி வீடு சொல்லுங்க',
      'indi price sollunga',
    ];
    for (const phrase of nonSwitches) {
      assert.notEqual(
        detectExplicitLanguageSwitch(phrase),
        'Hindi',
        `Expected non-Hindi switch for "${phrase}"`
      );
    }

    const promoted = resolveServerConversationLanguage('Tamil-English', [
      { role: 'assistant', content: 'Vanakkam Sir! Property pathi pesalama?' },
      { role: 'user', content: 'talk in hindi' },
    ]);
    assert.equal(promoted, 'Hindi');
    assert.ok(getLanguageSwitchOverridePrompt('Tamil-English', promoted).includes('Hindi'));

    const unchanged = resolveServerConversationLanguage('Tamil-English', [
      { role: 'user', content: '2 BHK in Velachery price enna?' },
    ]);
    assert.equal(unchanged, 'Tamil-English');
    assert.equal(getLanguageSwitchOverridePrompt('Tamil-English', unchanged), '');

    assert.equal(detectExplicitLanguageSwitch('i want to talk in hindi'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('நான் ஹிந்தியில் பேச வேண்டும்'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('ஐ வாண்ட் டு டாக் இன் ஹிந்தி'), 'Hindi');
    assert.equal(detectExplicitLanguageSwitch('स्पीक इन इंग्लिश'), 'English');
  });

  run('resolveCloudSttLanguageParam: locks cloud STT to hi-IN after explicit Hindi switch so queries write in Hindi', () => {
    assert.equal(resolveCloudSttLanguageParam('groq', 'Tamil-English', false), 'auto');
    assert.equal(resolveCloudSttLanguageParam('groq', 'Hindi', false), 'auto');
    assert.equal(resolveCloudSttLanguageParam('groq', 'Hindi', true), 'hi-IN');
    assert.equal(resolveCloudSttLanguageParam('openai', 'Hindi', true), 'hi-IN');
    assert.equal(resolveCloudSttLanguageParam('deepgram', 'Hindi', true), 'hi-IN');
    assert.equal(resolveCloudSttLanguageParam('gemini', 'Hindi', true), 'hi-IN');
    assert.equal(resolveCloudSttLanguageParam('groq', 'English', true), 'en-IN');
    assert.equal(resolveCloudSttLanguageParam('groq', 'Tamil-English', true), 'auto');
    assert.equal(resolveCloudSttLanguageParam('sarvam', 'Hindi', false), 'hi-IN');
  });

  return results;
}
