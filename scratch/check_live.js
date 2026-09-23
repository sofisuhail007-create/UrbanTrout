async function main() {
  const res = await fetch("https://urbantrout.in", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const keywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*>/i)?.[0];
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1];
  
  console.log("=== LIVE HTTP RESPONSE FROM https://urbantrout.in ===");
  console.log("STATUS:", res.status);
  console.log("LIVE TITLE:", title);
  console.log("LIVE H1:", h1);
  console.log("LIVE META DESC:", metaDesc);
  console.log("LIVE KEYWORDS TAG:", keywords ? keywords : "NONE (DELETED)");
  console.log("CONTAINS 5km?:", html.includes("5km") || html.includes("5 km"));
  console.log("CONTAINS 'mountain water'?:", html.toLowerCase().includes("mountain water"));
  console.log("CONTAINS '₹500'?:", html.includes("₹500"));
  console.log("CONTAINS '₹540'?:", html.includes("₹540"));
  console.log("CONTAINS '₹580'?:", html.includes("₹580"));
  console.log("CONTAINS 'dead fish'?:", html.includes("dead fish"));
  console.log("CONTAINS FSSAI?:", html.includes("FSSAI"));
  console.log("CONTAINS Kashmiri Marinade?:", html.includes("The Signature Marinade"));
}
main();
