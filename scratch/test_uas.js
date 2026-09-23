async function testUserAgents() {
  const uas = [
    "ClaudeBot/1.0; +claudebot@anthropic.com",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "curl/7.68.0"
  ];

  for (const ua of uas) {
    const res = await fetch("https://urbantrout.in", {
      headers: { "User-Agent": ua },
      cache: "no-store"
    });
    const html = await res.text();
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const has5km = html.includes("5km") || html.includes("5 km");
    const hasFSSAI = html.includes("FSSAI");
    const hasKeywords = html.includes('name="keywords"');

    console.log(`UA: ${ua.split(' ')[0]}`);
    console.log(`  TITLE: ${title}`);
    console.log(`  H1: ${h1}`);
    console.log(`  has5km: ${has5km}, hasFSSAI: ${hasFSSAI}, hasKeywords: ${hasKeywords}`);
  }
}
testUserAgents();
