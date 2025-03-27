const axios = require("axios");

const OLLAMA_HOST = "http://127.0.0.1:11434";

async function correctWord(word, context) {
  const prompt = `Correct this Malayalam word in the given context. Only reply with the corrected word.
       Word: "${word}"
       Context: "${context}"
       Important: Only reply with the corrected Malayalam word, nothing else.`;

  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: "mistral",
      prompt,
      options: {
        temperature: 0.1,
      },
      stream: false,
    });

    // Clean up the response to get just the corrected word
    let corrected = response.data.response.trim();
    corrected = corrected.replace(/^["']|["']$/g, ""); // Remove surrounding quotes if any
    return corrected;
  } catch (error) {
    console.error("LLM error:", error);
    return word; // Return original if error occurs
  }
}

module.exports = { correctWord };
