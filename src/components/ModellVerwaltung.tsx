import { useState } from "react";

interface ModellInfo {
  fileId: string;
  name: string;
  versionId?: string;
  neueVersion?: boolean;
}

interface TCFile {
  id: string;
  name: string;
  isFolder: boolean;
  versionId?: string;
  modifiedOn?: string;
}

interface Props {
  modelle: ModellInfo[];
  setModelle: (m: ModellInfo[]) => void;
  accessToken: string;
  projectId: string;
}

const TC = "https://app.connect.trimble.com/tc/api/2.0";

function proxyUrl(url: string, token: string) {
  return `/api/tc?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
}

export default function ModellVerwaltung({ modelle, setModelle, accessToken, projectId }: Props) {
  const [zeigeExplorer, setZeigeExplorer] = useState(false);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [items, setItems] = useState<TCFile[]>([]);
  const [pfad, setPfad] = useState<{ id: string; name: string }[]>([]);
  const [explorerLaden, setExplorerLaden] = useState(false);
  const [explorerFehler, setExplorerFehler] = useState("");
  const [aktualisiereLaden, setAktualisiereLaden] = useState(false);
  const [aktualisiereStatus, setAktualisiereStatus] = useState("");

  async function ladeOrdner(folderId?: string) {
    if (!accessToken || !projectId) return;
    setExplorerLaden(true);
    setExplorerFehler("");
    try {
      const url = folderId
        ? `${TC}/projects/${projectId}/files?folderId=${folderId}`
        : `${TC}/projects/${projectId}/files`;
      const res = await fetch(proxyUrl(url, accessToken));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result: TCFile[] = [];
      for (const f of (data.folders || [])) {
        result.push({ id: f.id, name: f.name || f.displayName, isFolder: true });
      }
      for (const f of (data.files || [])) {
        const name = f.name || f.displayName || "";
        result.push({
          id: f.id || f.versionId || f.fileId,
          name,
          isFolder: false,
          versionId: f.versionId || f.id,
          modifiedOn: f.modifiedOn,
        });
      }
      setItems(result);
    } catch (e) {
      setExplorerFehler("Dateien konnten nicht geladen werden.");
      console.error(e);
    } finally { setExplorerLaden(false); }
  }

  function explorerOeffnen() {
    setZeigeExplorer(true);
    ladeOrdner();
  }

  function ordnerOeffnen(id: string, name: string) {
    setPfad(p => [...p, { id, name }]);
    ladeOrdner(id);
  }

  function zurueck() {
    const neu = pfad.slice(0, -1);
    setPfad(neu);
    ladeOrdner(neu.length > 0 ? neu[neu.length - 1].id : undefined);
  }

  function toggleModell(file: TCFile) {
    const bereits = modelle.find(m => m.fileId === file.id);
    if (bereits) {
      setModelle(modelle.filter(m => m.fileId !== file.id));
    } else {
      setModelle([...modelle, {
        fileId: file.id,
        name: file.name,
        versionId: file.versionId,
      }]);
    }
  }

  async function versionenPruefen() {
    if (!accessToken || modelle.length === 0) return;
    setAktualisiereLaden(true);
    setAktualisiereStatus("Prüfe Versionen...");
    let neueVersionen = 0;
    try {
      const aktualisiert = await Promise.all(modelle.map(async (m) => {
        try {
          const url = `${TC}/files/${m.fileId}/versions`;
          const res = await fetch(proxyUrl(url, accessToken));
          if (!res.ok) return m;
          const data = await res.json();
          const versionen = Array.isArray(data) ? data : data.versions || [];
          if (versionen.length === 0) return m;
          const neuesteVersion = versionen[0];
          const neueVersionId = neuesteVersion.id || neuesteVersion.versionId;
          const hatNeueVersion = m.versionId && neueVersionId && neueVersionId !== m.versionId;
          if (hatNeueVersion) neueVersionen++;
          return { ...m, neueVersion: !!hatNeueVersion, versionId: neueVersionId };
        } catch { return m; }
      }));
      setModelle(aktualisiert);
      setAktualisiereStatus(
        neueVersionen > 0
          ? `✓ ${neueVersionen} neue Version(en) gefunden und aktualisiert`
          : "✓ Alle Modelle aktuell"
      );
    } catch (e) {
      setAktualisiereStatus("Fehler beim Prüfen.");
    } finally { setAktualisiereLaden(false); }
  }

  const ifcDateien = items.filter(i => !i.isFolder && i.name.toLowerCase().endsWith(".ifc"));
  const ordner = items.filter(i => i.isFolder);

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--tc-text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>
        Verknüpfte Modelle
      </div>

      {/* Modell-Liste (kollabierbar) */}
      {modelle.length > 0 && (
        <div style={{ border: "1px solid var(--tc-border)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          <div
            style={{ padding: "7px 10px", background: "var(--tc-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setEingeklappt(!eingeklappt)}
          >
            <span style={{ fontSize: 12, color: "var(--tc-text)", fontWeight: 500 }}>
              🏗️ {modelle.length} Modell(e) verknüpft
            </span>
            <span style={{ fontSize: 10, color: "var(--tc-text-3)" }}>{eingeklappt ? "▼" : "▲"}</span>
          </div>
          {!eingeklappt && modelle.map(m => (
            <div key={m.fileId} style={{ padding: "6px 10px", borderTop: "1px solid var(--tc-border-light)", display: "flex", alignItems: "center", gap: 8, background: "var(--tc-white)" }}>
              <span style={{ fontSize: 14 }}>🏗️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--tc-text)", fontWeight: 500 }}>{m.name}</div>
                {m.neueVersion && (
                  <div style={{ fontSize: 10, color: "var(--tc-orange)" }}>⚠ Neue Version verfügbar</div>
                )}
              </div>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tc-red)", fontSize: 12 }}
                onClick={() => setModelle(modelle.filter(x => x.fileId !== m.fileId))}>✕</button>
            </div>
          ))}
        </div>
      )}

      {modelle.length === 0 && (
        <div style={{ padding: "10px", border: "1px dashed var(--tc-border)", borderRadius: 6, textAlign: "center", fontSize: 11, color: "var(--tc-text-3)", marginBottom: 8 }}>
          Noch keine Modelle verknüpft
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button
          className="tc-btn-primary"
          style={{ flex: 1, padding: "7px 0", fontSize: 12 }}
          onClick={explorerOeffnen}>
          + Modelle hinzufügen
        </button>
        {modelle.length > 0 && (
          <button
            className="tc-btn-secondary"
            style={{ padding: "7px 12px", fontSize: 12 }}
            disabled={aktualisiereLaden}
            onClick={versionenPruefen}>
            {aktualisiereLaden ? "⟳" : "⟳ Aktualisieren"}
          </button>
        )}
      </div>

      {aktualisiereStatus && (
        <div style={{ fontSize: 11, padding: "5px 8px", borderRadius: 4, background: aktualisiereStatus.includes("Fehler") ? "var(--tc-red-light)" : "var(--tc-green-light)", color: aktualisiereStatus.includes("Fehler") ? "var(--tc-red)" : "var(--tc-green)", marginBottom: 6 }}>
          {aktualisiereStatus}
        </div>
      )}

      {/* TC File Explorer */}
      {zeigeExplorer && (
        <div style={{ border: "1.5px solid var(--tc-blue)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ padding: "8px 10px", background: "var(--tc-blue-light)", borderBottom: "1px solid var(--tc-blue-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-blue)" }}>IFC-Modelle wählen</span>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tc-text-3)", fontSize: 14 }}
              onClick={() => { setZeigeExplorer(false); setPfad([]); }}>✕</button>
          </div>

          {/* Breadcrumb */}
          <div style={{ padding: "6px 10px", background: "var(--tc-bg)", borderBottom: "1px solid var(--tc-border)", fontSize: 11, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <span style={{ color: "var(--tc-blue)", cursor: "pointer" }} onClick={() => { setPfad([]); ladeOrdner(); }}>📁 Ablage</span>
            {pfad.map((p, i) => (
              <span key={p.id}>
                <span style={{ color: "var(--tc-text-3)" }}> / </span>
                <span style={{ color: "var(--tc-blue)", cursor: "pointer" }}
                  onClick={() => { const neu = pfad.slice(0, i + 1); setPfad(neu); ladeOrdner(p.id); }}>
                  {p.name}
                </span>
              </span>
            ))}
            {pfad.length > 0 && (
              <button style={{ marginLeft: "auto", background: "none", border: "1px solid var(--tc-border)", color: "var(--tc-text-2)", padding: "1px 7px", fontSize: 10, cursor: "pointer", borderRadius: 3, fontFamily: "inherit" }}
                onClick={zurueck}>← Zurück</button>
            )}
          </div>

          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {explorerLaden && <div style={{ padding: 12, fontSize: 12, color: "var(--tc-text-3)", textAlign: "center" }}>⟳ Lade...</div>}
            {explorerFehler && <div style={{ padding: 10, fontSize: 11, color: "var(--tc-red)", background: "var(--tc-red-light)" }}>{explorerFehler}</div>}
            {!explorerLaden && items.length === 0 && <div style={{ padding: 12, fontSize: 11, color: "var(--tc-text-3)", textAlign: "center" }}>Keine Dateien</div>}

            {ordner.map(o => (
              <div key={o.id} onClick={() => ordnerOeffnen(o.id, o.name)}
                style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: "1px solid var(--tc-border-light)", fontSize: 12, color: "var(--tc-text)" }}>
                <span>📁</span><span style={{ flex: 1 }}>{o.name}</span><span style={{ color: "var(--tc-text-3)" }}>›</span>
              </div>
            ))}

            {ifcDateien.map(f => {
              const ausgewaehlt = modelle.some(m => m.fileId === f.id);
              return (
                <div key={f.id} onClick={() => toggleModell(f)}
                  style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: "1px solid var(--tc-border-light)", fontSize: 12, background: ausgewaehlt ? "var(--tc-blue-light)" : "var(--tc-white)" }}>
                  <input type="checkbox" checked={ausgewaehlt} onChange={() => toggleModell(f)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 14, height: 14, accentColor: "var(--tc-blue)", cursor: "pointer" }} />
                  <span>🏗️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "var(--tc-text)", fontWeight: ausgewaehlt ? 500 : 400 }}>{f.name}</div>
                    {f.modifiedOn && <div style={{ fontSize: 10, color: "var(--tc-text-3)" }}>{new Date(f.modifiedOn).toLocaleDateString("de-CH")}</div>}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, background: "var(--tc-green-light)", color: "var(--tc-green)", padding: "2px 5px", borderRadius: 3 }}>IFC</span>
                </div>
              );
            })}

            {!explorerLaden && ifcDateien.length === 0 && ordner.length === 0 && (
              <div style={{ padding: 12, fontSize: 11, color: "var(--tc-text-3)", textAlign: "center" }}>Keine IFC-Dateien in diesem Ordner</div>
            )}
          </div>

          <div style={{ padding: "8px 10px", background: "var(--tc-bg)", borderTop: "1px solid var(--tc-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--tc-green)" }}>
              {modelle.length > 0 ? `✓ ${modelle.length} gewählt` : ""}
            </span>
            <button className="tc-btn-primary" style={{ padding: "5px 14px", fontSize: 12 }}
              onClick={() => { setZeigeExplorer(false); setPfad([]); setEingeklappt(false); }}>
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}