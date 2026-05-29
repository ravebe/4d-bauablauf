import { useState, useRef } from "react";
import type { Task, TaskTyp } from "../types";
import type { ViewerState } from "../hooks/useApi";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  api: any;
  viewerState: ViewerState;
}

interface AttributMap {
  [key: string]: Set<string>;
}

export default function TaskList({ tasks, setTasks, api, viewerState }: Props) {
  const { selektion, aktivesModellId } = viewerState;
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [attributKey, setAttributKey] = useState("");
  const [attributValue, setAttributValue] = useState("");
  const [laden, setLaden] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; typ: "ok" | "err" | "info" } | null>(null);
  const [attributMap, setAttributMap] = useState<AttributMap>({});
  const [attributeLaden, setAttributeLaden] = useState(false);
  const [keyVorschlaege, setKeyVorschlaege] = useState<string[]>([]);
  const [valueVorschlaege, setValueVorschlaege] = useState<string[]>([]);
  const [showKeyDrop, setShowKeyDrop] = useState(false);
  const [showValueDrop, setShowValueDrop] = useState(false);
  const keyRef = useRef<HTMLDivElement>(null);

  async function ladeAttribute() {
    if (!api || !aktivesModellId) return;
    setAttributeLaden(true);
    try {
      const objekte = await api.viewer.getObjects(aktivesModellId);
      const rohe = Array.isArray(objekte) ? objekte : [];
      const ids = rohe.slice(0, 150).map((o: any) =>
        typeof o === "string" ? o : o?.id ?? String(o)
      ).filter(Boolean);

      const eigenschaften = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const props = Array.isArray(eigenschaften) ? eigenschaften : [];
      const map: AttributMap = {};

      for (const obj of props) {
        for (const gruppe of (obj?.properties ?? [])) {
          for (const prop of (gruppe?.properties ?? [])) {
            if (!prop?.name) continue;
            if (!map[prop.name]) map[prop.name] = new Set();
            if (prop.value != null) map[prop.name].add(String(prop.value));
          }
        }
      }
      setAttributMap(map);
    } catch (err) {
      console.error("Attribute laden:", err);
    } finally {
      setAttributeLaden(false);
    }
  }

  function onKeyChange(val: string) {
    setAttributKey(val);
    setAttributValue("");
    if (!val) { setKeyVorschlaege([]); setShowKeyDrop(false); return; }
    const treffer = Object.keys(attributMap)
      .filter(k => k.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setKeyVorschlaege(treffer);
    setShowKeyDrop(treffer.length > 0);
  }

  function selectKey(k: string) {
    setAttributKey(k);
    setShowKeyDrop(false);
    setAttributValue("");
    const werte = attributMap[k] ? [...attributMap[k]].slice(0, 10) : [];
    setValueVorschlaege(werte);
    setShowValueDrop(werte.length > 0);
  }

  function onValueChange(val: string) {
    setAttributValue(val);
    if (!attributKey || !attributMap[attributKey]) { setShowValueDrop(false); return; }
    const werte = [...attributMap[attributKey]]
      .filter(v => v.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setValueVorschlaege(werte);
    setShowValueDrop(werte.length > 0);
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

  async function markiereImViewer(guids: string[]) {
    if (!api || !aktivesModellId || guids.length === 0) return;
    try {
      const runtimeIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, guids);
      await api.viewer.setSelection(runtimeIds);
    } catch (e) { console.warn("Markierung:", e); }
  }

  async function taskAnklicken(taskId: string) {
    const neuerTask = aktiverTask === taskId ? null : taskId;
    setAktiverTask(neuerTask);
    setMeldung(null);
    setAttributKey("");
    setAttributValue("");
    setShowKeyDrop(false);
    setShowValueDrop(false);
    if (neuerTask) {
      if (Object.keys(attributMap).length === 0) ladeAttribute();
      const task = tasks.find(t => t.id === taskId);
      if (task && task.objektGuids.length > 0) markiereImViewer(task.objektGuids);
    }
  }

  async function perAttributZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    if (!attributKey || !attributValue) { setMeldung({ text: "Attribut und Wert eingeben.", typ: "err" }); return; }
    setLaden(true);
    setMeldung({ text: "⟳ Suche Bauteile...", typ: "info" });
    try {
      const roheObjekte = await api.viewer.getObjects(aktivesModellId);
      const objekte = Array.isArray(roheObjekte) ? roheObjekte : [];
      const ids = objekte.map((o: any) => typeof o === "string" ? o : o?.id ?? String(o)).filter(Boolean);

      const roheEigen = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const eigenschaften = Array.isArray(roheEigen) ? roheEigen : [];
      const gefundeneGuids: string[] = [];

      for (const obj of eigenschaften) {
        let gefunden = false;
        for (const gruppe of (obj?.properties ?? [])) {
          if (gefunden) break;
          for (const prop of (gruppe?.properties ?? [])) {
            if (
              prop?.name?.toLowerCase().includes(attributKey.toLowerCase()) &&
              String(prop?.value ?? "").toLowerCase().includes(attributValue.toLowerCase())
            ) {
              gefundeneGuids.push(obj.id);
              gefunden = true;
              break;
            }
          }
        }
      }

      if (gefundeneGuids.length === 0) {
        setMeldung({ text: "Keine Bauteile mit diesem Attribut gefunden.", typ: "err" });
        setLaden(false);
        return;
      }

      await markiereImViewer(gefundeneGuids);
      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...gefundeneGuids])] }
          : t
      ));
      setMeldung({ text: `✓ ${gefundeneGuids.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (err) {
      console.error("Attribut-Filter:", err);
      setMeldung({ text: "Fehler bei der Suche.", typ: "err" });
    } finally {
      setLaden(false);
    }
  }

  // KERN-FIX: Selektion kommt jetzt als Event aus useApi
  async function perKlickZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }

    console.log("Aktuelle Selektion aus Event:", selektion);

    if (!selektion || selektion.length === 0) {
      setMeldung({ text: "Keine Bauteile ausgewählt. Bitte im 3D Viewer anklicken.", typ: "err" });
      return;
    }

    try {
      const guids = await api.viewer.convertToObjectIds(aktivesModellId, selektion);
      const guidsArr = Array.isArray(guids) ? guids.filter(Boolean) : [];

      if (guidsArr.length === 0) {
        setMeldung({ text: "GUIDs konnten nicht gelesen werden.", typ: "err" });
        return;
      }

      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guidsArr])] }
          : t
      ));
      setMeldung({ text: `✓ ${guidsArr.length} Bauteile übernommen.`, typ: "ok" });
    } catch (err) {
      console.error("Klick-Zuweisung:", err);
      setMeldung({ text: "Fehler beim Übernehmen.", typ: "err" });
    }
  }

  if (!aktivesModellId) {
    return (
      <div className="panel">
        <div className="alert warn">⚠ Kein Modell erkannt. Öffne den "Modelle" Tab.</div>
      </div>
    );
  }

  return (
    <div className="panel" onClick={() => { setShowKeyDrop(false); setShowValueDrop(false); }}>
      <div className="section-header">
        <span>Bauteile zuweisen</span>
        {selektion.length > 0 && (
          <span style={{ color: "#0a84ff", fontSize: 10 }}>
            {selektion.length} ausgewählt
          </span>
        )}
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info-alert"}`}>
          {meldung.text}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="empty-state">
          <p>Bitte zuerst eine Gantt-Datei laden.</p>
        </div>
      )}

      {tasks.map(task => (
        <div key={task.id} className={`task-card ${aktiverTask === task.id ? "offen" : ""}`}>
          <div className="task-header" onClick={() => taskAnklicken(task.id)}>
            <span className={`typ-dot ${task.typ}`}>●</span>
            <span className="task-name">{task.name}</span>
            <div className="task-meta">
              <span className={`typ-badge ${task.typ}`}>{task.typ}</span>
              <span className="bauteil-count">
                {task.objektGuids.length > 0
                  ? <span style={{ color: "#0a84ff" }}>⬡ {task.objektGuids.length}</span>
                  : <span style={{ color: "#444" }}>∅</span>
                }
              </span>
              <span className="chevron">{aktiverTask === task.id ? "▲" : "▼"}</span>
            </div>
          </div>

          {aktiverTask === task.id && (
            <div className="task-detail" onClick={e => e.stopPropagation()}>

              <div className="detail-block">
                <div className="sub-label">Task-Typ</div>
                <div className="typ-auswahl">
                  {(["neubau", "bestand", "abbruch"] as TaskTyp[]).map(typ => (
                    <button
                      key={typ}
                      className={`typ-btn ${task.typ === typ ? `aktiv-${typ}` : ""}`}
                      onClick={() => typAendern(task.id, typ)}
                    >
                      {typ === "neubau" ? "🟢" : typ === "bestand" ? "🟡" : "🔴"} {typ}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-block">
                <div className="sub-label">
                  IFC-Attribut Filter
                  {attributeLaden && <span className="laden-text"> ⟳ Lade...</span>}
                </div>

                <div ref={keyRef} className="autocomplete-wrap">
                  <input
                    className="attr-input"
                    placeholder="Attributname (z.B. Geschoss, Type...)"
                    value={attributKey}
                    onChange={e => { e.stopPropagation(); onKeyChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => keyVorschlaege.length > 0 && setShowKeyDrop(true)}
                  />
                  {showKeyDrop && (
                    <div className="dropdown" onClick={e => e.stopPropagation()}>
                      {keyVorschlaege.map(k => (
                        <div key={k} className="dropdown-item" onClick={() => selectKey(k)}>{k}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="autocomplete-wrap">
                  <input
                    className="attr-input"
                    placeholder="Wert (z.B. OG1, Beton, BA-03)"
                    value={attributValue}
                    onChange={e => { e.stopPropagation(); onValueChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => valueVorschlaege.length > 0 && setShowValueDrop(true)}
                  />
                  {showValueDrop && (
                    <div className="dropdown" onClick={e => e.stopPropagation()}>
                      {valueVorschlaege.map(v => (
                        <div key={v} className="dropdown-item" onClick={() => { setAttributValue(v); setShowValueDrop(false); }}>{v}</div>
                      ))}
                    </div>
                  )}
                </div>

                <button className="btn-primary" onClick={() => perAttributZuweisen(task.id)} disabled={laden || !attributKey || !attributValue}>
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              <div className="detail-block">
                <div className="sub-label">Mausklick Zuweisung</div>
                <div className={`selektion-status ${selektion.length > 0 ? "aktiv" : ""}`}>
                  {selektion.length > 0
                    ? `✓ ${selektion.length} Bauteil(e) im Viewer ausgewählt`
                    : "Kein Bauteil ausgewählt – im 3D Viewer anklicken"
                  }
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => perKlickZuweisen(task.id)}
                  disabled={selektion.length === 0}
                >
                  ✓ Ausgewählte Bauteile übernehmen ({selektion.length})
                </button>
              </div>

              {task.objektGuids.length > 0 && (
                <div className="detail-block">
                  <div className="sub-label-row">
                    <span>{task.objektGuids.length} Bauteile</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-xs" onClick={() => markiereImViewer(task.objektGuids)}>👁 Markieren</button>
                      <button className="btn-xs danger" onClick={() => alleEntfernen(task.id)}>🗑 Alle</button>
                    </div>
                  </div>
                  <div className="guid-liste">
                    {task.objektGuids.map(guid => (
                      <div key={guid} className="guid-item">
                        <span className="guid-text">{guid.slice(0, 22)}...</span>
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