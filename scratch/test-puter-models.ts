const token = process.env.PUTER_AUTH_TOKEN;

async function testModels() {
  console.log("Testing Puter OpenAI endpoint...");
  try {
    const response = await fetch("https://api.puter.com/puterai/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log("Available Models:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to fetch models:", err);
  }
}

testModels();
