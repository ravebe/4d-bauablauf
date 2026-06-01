import { useState, useEffect } from "react";

interface TCFile {
  id: string;
  name: string;
  isFolder: boolean;
  fileType?: string;
  size?: number;
  modifiedOn?: string;
}

interface Props {
  accessToken: string;
  projectId: string;
  ausgewaehlteIds: string[];
  setAusgewaehlteIds: (ids: string[]) => void;
}

const PROXY = "/api/tc";
const TC = "https://app.connect.trimble.com/tc/api/2.0";

function proxyUrl(url: string, token: string) {
  return `${PROXY}?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
}

export default function FileBrowser({ accessToken, projectId, ausgewaehlteIds, setAusgewaehlteIds }: Props) {
  const [items, setItems] = useState<TCFile[]>([]);
  const [pfad, setPfad] = useState<{ id: string; name: string }[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");

  async function lade(folderId?: string) {
    if (!accessToken) return;
    setLaden(true); setFehler("");
    try {
      const base = folderId
        ? `${TC}/projects/${projectId}/files?folderId=${folderId}`
        : `${TC}/projects/${projectId}/files`;

      const res = await fetch(proxyUrl(base, accessToken));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const result: TCFile[] = [];
      for (const f of (data.folders || [])) {
        result.push({ id: f.id, name: f.name || f.displayName, isFolder: true });
      }
      for (const f of (data.files || [])) {
        const name: string = f.name || f.displayName || "";
        result.push({
          id: f.id || f.versionId,
          name,
          isFolder: false,
          fileType: (f.fileType || name.split(".").pop() || "").toUpperCase(),
          size: f.size,
          modifiedOn: f.modifiedOn,
        });
      }
      setItems(result);
    } catch (e) {
      setFehler("Dateien konnten nicht geladen werden. " + String(e));
    } finally { setLaden(false); }
  }

  useEffect(() => { if (accessToken && projectId) lade(); }, [accessToken, projectId]);

  function oeffne(id: string, name: string) {
    setPfad(p => [...p, { id, name }]);
    lade(id);
  }

  function zurueck() {
    const neu = pfad.slice(0, -1);
    setPfad(neu);
    lade(neu.length > 0 ? neu[neu.length - 1].id : undefined);
  }

  function toggle(id: string) {
    setAusgewaehlteIds(
      ausgewaehlteIds.includes(id)
        ? ausgewaehlteIds.filter(x => x !== id)
        : [...ausgewaehlteIds, id]
    );
  }

  const ordner = items.filter(i => i.isFolder);
  const ifc = items.filter(i => !i.isFolder && i.name.toLowerCase().endsWith(".ifc"));
  const andere = items.filter(i => !i.isFolder && !i.name.toLowerCase().endsWith(".ifc"));

  return (
    <div className="file-browser">
      <div className="fb-breadcrumb">
        <span className="fb-crumb" onClick={() => { setPfad([]); lade(); }}>
          📁 Ablage
        </span>
        {pfad.map((p, i) => (
          <span key={p.id}>
            <span className="fb-sep"> / </span>
            <span className="fb-crumb" onClick={() => {
              const neu = pfad.slice(0, i + 1);
              setPfad(neu);
              lade(p.id);
            }}>{p.name}</span>
          </span>
        ))}
        {pfad.length > 0 && (
          <button className="fb-back" onClick={zurueck}>← Zurück</button>
        )}
      </div>

      {laden && <div className="fb-loading">⟳ Lade Dateien...</div>}
      {fehler && <div className="alert error" style={{ fontSize: 11 }}>{fehler}</div>}

      {!laden && items.length === 0 && !fehler && (
        <div className="fb-empty">Keine Dateien in diesem Ordner.</div>
      )}

      {ordner.map(o => (
        <div key={o.id} className="fb-item fb-folder" onClick={() => oeffne(o.id, o.name)}>
          <span className="fb-item-icon">📁</span>
          <span className="fb-item-name">{o.name}</span>
          <span className="fb-item-arrow">›</span>
        </div>
      ))}

      {ifc.map(f => (
        <div
          key={f.id}
          className={`fb-item fb-ifc ${ausgewaehlteIds.includes(f.id) ? "fb-selected" : ""}`}
          onClick={() => toggle(f.id)}
        >
          <input
            type="checkbox"
            checked={ausgewaehlteIds.includes(f.id)}
            onChange={() => toggle(f.id)}
            onClick={e => e.stopPropagation()}
            className="fb-checkbox"
          />
          <span className="fb-item-icon">🏗️</span>
          <div className="fb-item-info">
            <span className="fb-item-name">{f.name}</span>
            {f.modifiedOn && (
              <span className="fb-item-meta">
                {new Date(f.modifiedOn).toLocaleDateString("de-CH")}
              </span>
            )}
          </div>
          <span className="fb-badge ifc">IFC</span>
        </div>
      ))}

      {andere.slice(0, 3).map(f => (
        <div key={f.id} className="fb-item fb-other">
          <span className="fb-item-icon">📄</span>
          <span className="fb-item-name fb-muted">{f.name}</span>
          <span className="fb-badge">{f.fileType}</span>
        </div>
      ))}

      {ausgewaehlteIds.length > 0 && (
        <div className="fb-selected-info">
          ✓ {ausgewaehlteIds.length} IFC-Datei(en) ausgewählt
        </div>
      )}
    </div>
  );
}