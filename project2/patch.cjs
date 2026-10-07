const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(serverFile, 'utf8');

const cosineFunc = `
// Cosine Similarity for Vector Search
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// AI Agentic Chat endpoint powered by Groq & Gemini`;

content = content.replace('// AI Agentic Chat endpoint powered by Groq & Gemini', cosineFunc);

const chatLogicFind = `    if (isGreeting) {
      return res.json({
        reply: \`Hello and a very warm welcome to Lyka Realty! It is an absolute pleasure to assist you.\\n\\nAs a premier Dubai-based real estate brokerage that has proudly served 300+ clients across the UAE, we are here to provide expert, verified market guidance.\\n\\nMay I ask what you are looking for today? Are you interested in buying a residential home, renting, or exploring high-yield property investment opportunities across Dubai?\`,
        provider: 'Lyka Realty Polite Concierge'
      });
    }`;

const chatLogicReplace = `    if (isGreeting) {
      return res.json({
        reply: \`Hello and a very warm welcome to Lyka Realty! It is an absolute pleasure to assist you.\\n\\nAs a premier Dubai-based real estate brokerage that has proudly served 300+ clients across the UAE, we are here to provide expert, verified market guidance.\\n\\nMay I ask what you are looking for today? Are you interested in buying a residential home, renting, or exploring high-yield property investment opportunities across Dubai?\`,
        provider: 'Lyka Realty Polite Concierge'
      });
    }

    // 1.5 Convert User Message to Numerical Form & Store in MongoDB
    const queryEmbedding = await getEmbeddingVector(message);
    if (mongoDb) {
      await mongoDb.collection('customer_embeddings').insertOne({
        _id: 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        lead_id: currentLead?.id || 'GENERAL',
        text_content: message,
        vector: queryEmbedding.vector,
        dimensions: queryEmbedding.dimensions,
        model: queryEmbedding.model,
        storage: 'MongoDB',
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Could not store customer vector:', e.message));
    }

    // 1.6 Vector Similarity Search against Lyka Realty PDF Database
    let injectedPDFContext = "";
    if (localPdfEmbeddingsStore.length > 0) {
      const scoredDocs = localPdfEmbeddingsStore.map(doc => ({
        ...doc,
        score: cosineSimilarity(queryEmbedding.vector, doc.vector)
      })).sort((a, b) => b.score - a.score);
      
      const top2 = scoredDocs.slice(0, 2);
      injectedPDFContext = "\\n\\nRELEVANT KNOWLEDGE EXTRACTED FROM DATABASE VIA VECTOR SEARCH:\\n" + top2.map(d => \`- \${d.title}: \${d.text_content}\`).join('\\n\\n');
      console.log('RAG Match Found! Highest score:', top2[0].score.toFixed(3));
    }`;

content = content.replace(chatLogicFind, chatLogicReplace);

const promptFind = `Current known customer profile:
\${JSON.stringify(currentLead || {}, null, 2)}

Respond warmly, politely, concisely, and naturally as Lyka Realty's senior real-estate assistant.\`;`;

const promptReplace = `Current known customer profile:
\${JSON.stringify(currentLead || {}, null, 2)}\${injectedPDFContext}

Answer the customer according to the instructions and extracted knowledge above. 
Respond warmly, politely, concisely, and naturally as Lyka Realty's senior real-estate assistant.\`;`;

content = content.replace(promptFind, promptReplace);

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Patched server.ts successfully!');
