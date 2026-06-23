// Vercel Serverless Function: Proxy für TC REST API File-Upload
// Umgeht CORS-Blockade zwischen Extension (Vercel) und TC API

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST" });

  try {
    const { projectId, fileName, fileBase64, accessToken, region } = req.body;

    if (!projectId || !fileName || !fileBase64 || !accessToken) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const baseUrl = region === "us"
      ? "https://app.connect.trimble.com"
      : "https://app21.connect.trimble.com";

    // Ordner "Skizzentool" finden oder erstellen
    let folderId = null;
    try {
      const fr = await fetch(`${baseUrl}/tc/api/2.0/projects/${projectId}/folders?path=/Skizzentool`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (fr.ok) { const f = await fr.json(); folderId = f.id; }
    } catch {}

    if (!folderId) {
      try {
        const cr = await fetch(`${baseUrl}/tc/api/2.0/projects/${projectId}/folders`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Skizzentool", parentId: "root" }),
        });
        if (cr.ok) { const f = await cr.json(); folderId = f.id; }
      } catch {}
    }

    const fileBuffer = Buffer.from(fileBase64, "base64");
    const parentParam = folderId ? `&parentId=${folderId}` : "";

    const ur = await fetch(
      `${baseUrl}/tc/api/2.0/projects/${projectId}/files?fileName=${encodeURIComponent(fileName)}${parentParam}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/pdf" },
        body: fileBuffer,
      }
    );

    if (!ur.ok) {
      return res.status(ur.status).json({ error: `TC: ${ur.status}`, details: await ur.text() });
    }

    const fd = await ur.json();
    return res.status(200).json({
      success: true,
      fileId: fd.versionId || fd.id || fd.fileId,
      fileName: fd.name || fileName,
      raw: fd,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server Error" });
  }
}
