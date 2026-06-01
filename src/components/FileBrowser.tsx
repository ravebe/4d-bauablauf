import { useState, useEffect } from "react";

interface TCFile {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  isFolder: boolean;
  fileType?: string;
}

interface Props {
  accessToken: string;
  projectId: string;
  ausgewaehlteIds: string[];
  setAusgewaehlteIds: (ids: string[]) => void;
}

const TC_API = "https://app.connect.trimble.com/tc/api/2.0";

export default function FileBrowser({ accessToken, projectId, ausgewaehlteIds, setAusgewaehlteIds }: Props) {
  const [dateien, setDateien] = useState<TCFile[]>([]);
  const [ordnerPfad, setOrdnerPfad] = useState<{ id: string; name: string }[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");
  const [_aktuellerOrdner, setAktuellerOrdner] = useState<string | null>(null);

  async function ladeDateien(folderId?: string) {
    if (!accessToken || !projectId) {
      setFehler("Kein Access Token oder Projekt ID.");
      return;
    }
    setLaden(true);
    setFehler("");
    try {
      const url = folderId
        ? `${TC_API}/projects/${projectId}/files?folderId=${folderId}`
        : `${TC_API}/projects/${projectId}/files`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items: TCFile[] = [];
      // Ordner
      for (const f of (data.folders || data.items?.filter((i: any) => i.type === "folder") || [])) {
        items.push({
          id: f.id || f.folderId,
          name: f.name || f.displayName,
          type: "folder",
          isFolder: true,
        });
      }
      // Dateien
      for (const f of (data.files || data.items?.filter((i: any) => i.type !== "folder") || [])) {
        const name: string = f.name || f.displayName || "";
        const isIfc = name.toLowerCase().endsWith(".ifc") ||
          (f.fileType || "").toLowerCase() === "ifc";
        items.push({
          id: f.id || f.fileId || f.fileVersionId,
          name,
          type: "file",
          isFolder: false,
          fileType: f.fileType || name.split(".").pop()?.toUpperCase(),
        });
        void isIfc;
      }
      setDateien(items);
    } catch (e) {
      console.error("ladeDateien:", e);
      setFehler("Dateien konnten nicht geladen werden.");
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    if (accessToken && projectId) ladeDateien();
  }, [accessToken, projectId]);

  function ordnerOeffnen(id: string, name: string) {
    setOrdnerPfad(prev => [...prev, { id, name }]);
    setAktuellerOrdner(id);
    ladeDateien(id);
  }

  function zurueck() {
    const neuPfad = ordnerPfad.slice(0, -1);
    setOrdnerPfad(neuPfad);
    const eltern = neuPfad.length > 0 ? neuPfad[neuPfad.length - 1].id : undefined;
    setAktuellerOrdner(eltern || null);
    ladeDateien(eltern);
  }

  function toggleAuswahl(id: string) {
    if (ausgewaehlteIds.includes(id)) {
      setAusgewaehlteIds(ausgewaehlteIds.filter(x => x !== id));
    } else {
      setAusgewaehlteIds([...ausgewaehlteIds, id]);
    }
  }

  const ifcDateien = dateien.filter(d => !d.isFolder &&
    (d.name.toLowerCase().endsWith(".ifc") || d.fileType?.toLowerCase() === "ifc"));
  const ordner = dateien.filter(d => d.isFolder);
  const andereeDateien = dateien.filter(d => !d.isFolder &&
    !d.name.toLowerCase().endsWith(".ifc") && d.fileType?.toLowerCase() !== "ifc");

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span className="breadcrumb-item" onClick={() => {
          setOrdnerPfad([]);
          setAktuellerOrdner(null);
          ladeDateien();
        }}>📁 Ablage</span>
        {ordnerPfad.map((o, i) => (
          <span key={o.id}>
            <span className="breadcrumb-sep"> › </span>
            <span className="breadcrumb-item" onClick={() => {
              const neuPfad = ordnerPfad.slice(0, i + 1);
              setOrdnerPfad(neuPfad);
              setAktuellerOrdner(o.id);
              ladeDateien(o.id);
            }}>{o.name}</span>
          </span>
        ))}
      </div>

      {ordnerPfad.length > 0 && (
        <button className="btn-xs" onClick={zurueck} style={{ marginBottom: 6 }}>← Zurück</button>
      )}

      {laden && <p className="hinweis">⟳ Lade Dateien...</p>}
      {fehler && <div className="alert error">{fehler}</div>}

      {!laden && !fehler && dateien.length === 0 && (
        <div className="empty-state"><p>Keine Dateien gefunden.</p></div>
      )}

      {/* Ordner */}
      {ordner.map(o => (
        <div key={o.id} className="file-item folder" onClick={() => ordnerOeffnen(o.id, o.name)}>
          <span className="file-icon">📁</span>
          <span className="file-name">{o.name}</span>
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>›</span>
        </div>
      ))}

      {/* IFC Dateien */}
      {ifcDateien.map(f => (
        <div key={f.id} className={`file-item ifc ${ausgewaehlteIds.includes(f.id) ? "ausgewaehlt" : ""}`}
          onClick={() => toggleAuswahl(f.id)}>
          <input
            type="checkbox"
            checked={ausgewaehlteIds.includes(f.id)}
            onChange={() => toggleAuswahl(f.id)}
            onClick={e => e.stopPropagation()}
            style={{ marginRight: 6, flexShrink: 0 }}
          />
          <span className="file-icon">🏗️</span>
          <span className="file-name">{f.name}</span>
          <span className="file-type">IFC</span>
        </div>
      ))}

      {/* Andere Dateien (ausgegraut) */}
      {andereeDateien.slice(0, 5).map(f => (
        <div key={f.id} className="file-item andere">
          <span className="file-icon">📄</span>
          <span className="file-name" style={{ color: "var(--text-muted)" }}>{f.name}</span>
          <span className="file-type">{f.fileType}</span>
        </div>
      ))}

      {ausgewaehlteIds.length > 0 && (
        <div style={{ marginTop: 8, padding: "6px 10px", background: "#DFF6DD", borderRadius: 4, fontSize: 11, color: "#0A4A0A" }}>
          ✓ {ausgewaehlteIds.length} IFC-Datei(en) ausgewählt
        </div>
      )}
    </div>
  );
}