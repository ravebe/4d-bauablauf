export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { url, token } = req.query;
  if (!url || !token) { res.status(400).json({ error: "url and token required" }); return; }

  try {
    const response = await fetch(decodeURIComponent(url as string), {
      headers: {
        Authorization: `Bearer ${token as string}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy error", details: String(err) });
  }
}