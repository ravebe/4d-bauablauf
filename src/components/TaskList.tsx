import { useState, useRef } from "react";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  api: any;
  aktivesModellId: string;
}

interface AttributMap {
  [attributName: string]: Set<string>;
}

export default function TaskList({ tasks, setTasks, api, aktivesModellId }: Props) {
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [attributKey, setAttributKey] = useState("");
  const [attributValue, setAttributValue] = useState("");
  const [laden, setLaden] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; typ: "ok" | "err" | "info" } | null>(null);
  const [attributMap, setAttributMap] = useState<AttributMap>({});
  const [attributeLaden, setAttributeLaden] = useState(false);
  const [keyVorschlaege, setKeyVorschlaege] = useState<string[]>([]);
  const [valueVorschlaege, setValueVorschlaege] = useState<string[]>([]);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showValueDropdown, setShowValueDropdown] = useState(false);
  const keyRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  async function ladeAttribute() {
    if (!api || !aktivesModellId) return;
    setAttributeLaden(true);
    try {
      const objekte = await api.viewer.getObjects(aktivesModellId);
      const ids = objekte.slice(0, 200).map((o: any) => o.id || o);
      const eigenschaften = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const map: AttributMap = {};
      for (const obj of eigenschaften) {
        for (const gruppe of obj.properties || []) {
          for (const prop of gruppe.properties || []) {
            if (!prop.name) continue;
            if (!map[prop.name]) map[prop.name] = new Set();
            if (prop.value) map[prop.name].add(String(prop.value));
          }
        }
      }
      setAttributMap(map);
    } catch (err) {
      console.error("Attribute laden Fehler:", err);
    } finally {
      setAttributeLaden(false);
    }
  }

  function onAttributKeyChange(val: string) {
    setAttributKey(val);
    setAttributValue("");
    setValueVorschlaege([]);
    if (val.length === 0) {
      setKeyVorschlaege([]);
      setShowKeyDropdown(false);
      return;
    }
    const gefunden = Object.keys(attributMap)
      .filter(k => k.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setKeyVorschlaege(gefunden);
    setShowKeyDropdown(gefunden.length > 0);
  }

  function selectKey(key: string) {
    setAttributKey(key);
    setShowKeyDropdown(false);
    setAttributValue("");
    const werte = attributMap[key] ? [...attributMap[key]].slice(0, 10) : [];
    setValueVorschlaege(werte);
    setShowValueDropdown(werte.length > 0);
  }

  function onAttributValueChange(val: string) {
    setAttributValue(val);
    if (!attributKey || !attributMap[attributKey]) {
      setShowValueDropdown(false);
      return;
    }
    const werte = [...attributMap[attributKey]]
      .filter(v => v.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setValueVorschlaege(werte);
    setShowValueDropdown(werte.length > 0);
  }

  function selectValue(val: string) {
    setAttributValue(val);
    setShowValueDropdown(false);
  }

  function typAendern(taskId: string, typ: TaskTyp) {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, typ } : t));
  }

  function guidEntfernen(taskId: string, guid: string) {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, objektGuids: t.objektGuids.filter(g => g !== guid) } : t
    ));
  }

  function alleEntfernen(taskId: string) {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, objektGuids: [] } : t));
  }

  async function perAttributZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    if (!attributKey || !attributValue) { setMeldung({ text: "Attribut und Wert eingeben.", typ: "err" }); return; }
    setLaden(true);
    setMeldung({ text: "Suche Bauteile...", typ: "info" });
    try {
      const objekte = await api.viewer.getObjects(aktivesModellId);
      const ids = objekte.map((o: any) => o.id || o);
      const eigenschaften = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const gefundeneGuids: string[] = [];
      for (const obj of eigenschaften) {
        for (const gruppe of obj.properties || []) {
          for (const prop of gruppe.properties || []) {
            if (
              prop.name?.toLowerCase().includes(attributKey.toLowerCase()) &&
              String(prop.value)?.toLowerCase().includes(attributValue.toLowerCase())
            ) {
              gefundeneGuids.push(obj.id);
              break;
            }
          }
        }
      }
      if (gefundeneGuids.length === 0) {
        setMeldung({ text: "Keine Bauteile gefunden.", typ: "err" });
        setLaden(false);
        return;
      }
      try {
        const runtimeIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, gefundeneGuids);
        await api.viewer.setSelection(runtimeIds);
      } catch (e) {
        console.warn("Markierung fehlgeschlagen:", e);
      }
      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...gefundeneGuids])] }
          : t
      ));
      setMeldung({ text: `✓ ${gefundeneGuids.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (err) {
      console.error("Attribut-Filter Fehler:", err);
      setMeldung({ text: "Fehler bei der Suche.", typ: "err" });
    } finally {
      setLaden(false);
    }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    try {
      setMeldung({ text: "Lese Selektion...", typ: "info" });
      const selektion = await api.viewer.getSelection();
      if (!selektion || selektion.length === 0) {
        setMeldung({ text: "Keine Bauteile im 3D Viewer ausgewählt.", typ: "err" });
        return;
      }
      const runtimeIds: number[] = selektion
        .map((s: any) => {
          if (typeof s === "number") return s;
          if (s && typeof s.id === "number") return s.id;
          if (s && typeof s.entityId === "number") return s.entityId;
          return null;
        })
        .filter((id: number | null) => id !== null);

      if (runtimeIds.length === 0) {
        setMeldung({ text: "Konnte Selektion nicht lesen.", typ: "err" });
        return;
      }
      const guids = await api.viewer.convertToObjectIds(aktivesModellId, runtimeIds);
      if (!guids || guids.length === 0) {
        setMeldung({ text: "Keine GUIDs gefunden.", typ: "err" });
        return;
      }
      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guids])] }
          : t
      ));
      setMeldung({ text: `✓ ${guids.length} Bauteile übernommen.`, typ: "ok" });
    } catch (err) {
      console.error("Klick-Zuweisung Fehler:", err);
      setMeldung({ text: "Fehler beim Übernehmen. Bitte erneut versuchen.", typ: "err" });
    }
  }

  async function vorschauImViewer(taskId: string) {
    if (!api || !aktivesModellId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.objektGuids.length === 0) return;
    try {
      const runtimeIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, task.objektGuids);
      await api.viewer.setSelection(runtimeIds);
    } catch (e) {
      console.warn("Vorschau Fehler:", e);
    }
  }

  if (!aktivesModellId) {
    return (
      <div className="panel">
        <div className="alert warn">⚠ Bitte zuerst unter "Modelle" ein IFC-Modell auswählen.</div>
      </div>
    );
  }

  return (
    <div className="panel" onClick={() => { setShowKeyDropdown(false); setShowValueDropdown(false); }}>
      <div className="section-header">
        <span>Bauteile zuweisen</span>
        <span style={{ fontSize: 10, color: "#555" }}>{tasks.length} Tasks</span>
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info"}`}
          style={{ marginBottom: 8 }}>
          {meldung.text}
        </div>
      )}

      {tasks.length === 0 && (
        <p className="hinweis" style={{ textAlign: "center", padding: 20 }}>
          Bitte zuerst eine Gantt-Datei laden.
        </p>
      )}

      {tasks.map((task) => (
        <div key={task.id} className="task-card">
          <div
            className="task-header"
            onClick={(e) => {
              e.stopPropagation();
              const neuerTask = aktiverTask === task.id ? null : task.id;
              setAktiverTask(neuerTask);
              setMeldung(null);
              setAttributKey("");
              setAttributValue("");
              if (neuerTask && Object.keys(attributMap).length === 0) {
                ladeAttribute();
              }
            }}
          >
            <span className={`typ-dot ${task.typ}`}>●</span>
            <span className="task-name" style={{ flex: 1 }}>{task.name}</span>
            <span className="task-datum">{task.start}</span>
            <span className={`typ-badge ${task.typ}`}>{task.typ}</span>
            <span style={{ color: "#555", fontSize: 10 }}>
              {task.objektGuids.length > 0 ? `${task.objektGuids.length} 🔗` : "∅"}
            </span>
            <span style={{ color: "#444" }}>{aktiverTask === task.id ? "▲" : "▼"}</span>
          </div>

          {aktiverTask === task.id && (
            <div className="task-detail" onClick={e => e.stopPropagation()}>

              <div>
                <div className="sub-label">Task-Typ</div>
                <div className="typ-auswahl">
                  {(["neubau", "bestand", "abbruch"] as TaskTyp[]).map((typ) => (
                    <button
                      key={typ}
                      className={task.typ === typ ? `active ${typ}` : ""}
                      onClick={() => typAendern(task.id, typ)}
                    >
                      {typ === "neubau" ? "🟢" : typ === "bestand" ? "🟡" : "🔴"} {typ}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sub-section">
                <div className="sub-label">
                  Per IFC-Attribut suchen
                  {attributeLaden && <span style={{ color: "#666", marginLeft: 6 }}>⟳ Lade...</span>}
                </div>

                <div ref={keyRef} style={{ position: "relative", marginBottom: 6 }}>
                  <input
                    placeholder="Attributname (z.B. Geschoss, Type, Material)"
                    value={attributKey}
                    onChange={e => { e.stopPropagation(); onAttributKeyChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => { if (keyVorschlaege.length > 0) setShowKeyDropdown(true); }}
                    style={{ marginBottom: 0 }}
                  />
                  {showKeyDropdown && keyVorschlaege.length > 0 && (
                    <div className="autocomplete-dropdown" onClick={e => e.stopPropagation()}>
                      {keyVorschlaege.map(k => (
                        <div key={k} className="autocomplete-item" onClick={() => selectKey(k)}>
                          {k}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={valueRef} style={{ position: "relative", marginBottom: 6 }}>
                  <input
                    placeholder="Wert (z.B. OG1, Beton, BA-03)"
                    value={attributValue}
                    onChange={e => { e.stopPropagation(); onAttributValueChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => { if (valueVorschlaege.length > 0) setShowValueDropdown(true); }}
                    style={{ marginBottom: 0 }}
                  />
                  {showValueDropdown && valueVorschlaege.length > 0 && (
                    <div className="autocomplete-dropdown" onClick={e => e.stopPropagation()}>
                      {valueVorschlaege.map(v => (
                        <div key={v} className="autocomplete-item" onClick={() => selectValue(v)}>
                          {v}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden || !attributKey || !attributValue}
                >
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              <div className="sub-section">
                <div className="sub-label">Per Mausklick im 3D Viewer</div>
                <p className="hinweis">Wähle Bauteile im 3D Viewer an, dann klicke:</p>
                <button onClick={() => perKlickZuweisen(task.id)}>
                  ✓ Ausgewählte Bauteile übernehmen
                </button>
              </div>

              {task.objektGuids.length > 0 && (
                <div>
                  <div className="section-header">
                    <span>{task.objektGuids.length} Bauteile zugewiesen</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-small" onClick={() => vorschauImViewer(task.id)}>
                        👁 Im Viewer
                      </button>
                      <button className="btn-small btn-danger" onClick={() => alleEntfernen(task.id)}>
                        🗑 Alle
                      </button>
                    </div>
                  </div>
                  <div className="guid-liste">
                    {task.objektGuids.map((guid) => (
                      <div key={guid} className="guid-item">
                        <span>{guid.slice(0, 22)}...</span>
                        <button className="btn-remove" onClick={() => guidEntfernen(task.id, guid)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}