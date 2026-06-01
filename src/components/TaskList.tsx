import { useState, useRef } from "react";
import type { Task, TaskTyp } from "../types";
import type { ViewerState } from "../hooks/useApi";
import { parseObjectIds } from "../hooks/useApi";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  api: any;
  viewerState: ViewerState;
}

interface AttributMap { [k: string]: Set<string>; }

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
  const panelRef = useRef<HTMLDivElement>(null);

  async function zuExternalIds(runtimeIds: number[]): Promise<string[]> {
    try {
      const result = await api.viewer.convertToExternalIds(aktivesModellId, runtimeIds);
      const arr = Array.isArray(result) ? result.filter(Boolean) : [];
      if (arr.length > 0) return arr;
    } catch (e) { console.warn("convertToExternalIds:", e); }
    try {
      const result = await api.viewer.convertToObjectIds(aktivesModellId, runtimeIds);
      const arr = Array.isArray(result) ? result.filter(Boolean) : [];
      if (arr.length > 0) return arr;
    } catch (e) { console.warn("convertToObjectIds:", e); }
    return runtimeIds.map(String);
  }

  async function zuRuntimeIds(guids: string[]): Promise<number[]> {
    try {
      const result = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, guids);
      return Array.isArray(result) ? result.map(Number).filter(n => !isNaN(n)) : [];
    } catch (e) {
      console.warn("convertToObjectRuntimeIds:", e);
      const nums = guids.map(Number).filter(n => !isNaN(n));
      return nums;
    }
  }

  async function ladeAttribute() {
    if (!api || !aktivesModellId) return;
    setAttributeLaden(true);
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      console.log("getObjects:", JSON.stringify(rohe)?.slice(0, 200));
      const runtimeIds = parseObjectIds(rohe).slice(0, 150);
      if (!runtimeIds.length) { setAttributeLaden(false); return; }

      // FIX: Runtime IDs → External IDs für getObjectProperties
      const externalIds = await zuExternalIds(runtimeIds);
      console.log("External IDs sample:", externalIds.slice(0, 3));

      const props = await api.viewer.getObjectProperties(aktivesModellId, externalIds);
      console.log("Properties sample:", JSON.stringify(props)?.slice(0, 300));

      const map: AttributMap = {};
      for (const obj of (Array.isArray(props) ? props : [])) {
        for (const g of (obj?.properties || [])) {
          for (const p of (g?.properties || [])) {
            if (!p?.name) continue;
            if (!map[p.name]) map[p.name] = new Set();
            if (p.value != null) map[p.name].add(String(p.value));
          }
        }
      }
      setAttributMap(map);
      console.log("✅ Attribute geladen:", Object.keys(map).length);
    } catch (e) { console.error("ladeAttribute:", e); }
    finally { setAttributeLaden(false); }
  }

  function onKeyChange(val: string) {
    setAttributKey(val); setAttributValue("");
    if (!val) { setKeyVorschlaege([]); setShowKeyDrop(false); return; }
    const t = Object.keys(attributMap).filter(k => k.toLowerCase().includes(val.toLowerCase())).slice(0, 8);
    setKeyVorschlaege(t); setShowKeyDrop(t.length > 0);
  }

  function selectKey(k: string) {
    setAttributKey(k); setShowKeyDrop(false); setAttributValue("");
    const w = attributMap[k] ? [...attributMap[k]].slice(0, 10) : [];
    setValueVorschlaege(w); setShowValueDrop(w.length > 0);
  }

  function onValueChange(val: string) {
    setAttributValue(val);
    if (!attributKey || !attributMap[attributKey]) { setShowValueDrop(false); return; }
    const w = [...attributMap[attributKey]].filter(v => v.toLowerCase().includes(val.toLowerCase())).slice(0, 8);
    setValueVorschlaege(w); setShowValueDrop(w.length > 0);
  }

  function typAendern(id: string, typ: TaskTyp) {
    setTasks(tasks.map(t => t.id === id ? { ...t, typ } : t));
  }

  async function markiereImViewer(guids: string[]) {
    if (!api || !aktivesModellId || !guids.length) return;
    try {
      const runtimeIds = await zuRuntimeIds(guids);
      if (runtimeIds.length) await api.viewer.setSelection(runtimeIds);
    } catch (e) { console.warn("markiere:", e); }
  }

  async function taskAnklicken(taskId: string) {
    const neu = aktiverTask === taskId ? null : taskId;
    setAktiverTask(neu); setMeldung(null);
    setAttributKey(""); setAttributValue("");
    setShowKeyDrop(false); setShowValueDrop(false);
    if (neu) {
      if (!Object.keys(attributMap).length) ladeAttribute();
      const t = tasks.find(x => x.id === taskId);
      if (t?.objektGuids.length) markiereImViewer(t.objektGuids);
    }
  }

  async function perAttributZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    if (!attributKey || !attributValue) { setMeldung({ text: "Attribut und Wert eingeben.", typ: "err" }); return; }
    setLaden(true);
    setMeldung({ text: "⟳ Suche Bauteile...", typ: "info" });
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      const runtimeIds = parseObjectIds(rohe);
      if (!runtimeIds.length) { setMeldung({ text: "Keine Objekte gefunden.", typ: "err" }); setLaden(false); return; }

      // Runtime IDs → External IDs für Properties
      const externalIds = await zuExternalIds(runtimeIds);
      const props = await api.viewer.getObjectProperties(aktivesModellId, externalIds);

      const getroffeneExtIds: string[] = [];
      const getroffeneRuntimeIds: number[] = [];

      for (let i = 0; i < (Array.isArray(props) ? props.length : 0); i++) {
        const obj = props[i];
        let hit = false;
        for (const g of (obj?.properties || [])) {
          if (hit) break;
          for (const p of (g?.properties || [])) {
            if (p?.name?.toLowerCase().includes(attributKey.toLowerCase()) &&
              String(p?.value ?? "").toLowerCase().includes(attributValue.toLowerCase())) {
              if (externalIds[i]) getroffeneExtIds.push(externalIds[i]);
              if (runtimeIds[i] != null) getroffeneRuntimeIds.push(runtimeIds[i]);
              hit = true; break;
            }
          }
        }
      }

      if (!getroffeneExtIds.length) {
        setMeldung({ text: "Keine Bauteile mit diesem Attribut gefunden.", typ: "err" });
        setLaden(false); return;
      }

      await api.viewer.setSelection(getroffeneRuntimeIds);
      setTasks(tasks.map(t => t.id === taskId
        ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...getroffeneExtIds])] } : t));
      setMeldung({ text: `✓ ${getroffeneExtIds.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (e) {
      console.error("perAttr:", e);
      setMeldung({ text: "Fehler bei Suche.", typ: "err" });
    } finally { setLaden(false); }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!selektion.length) { setMeldung({ text: "Keine Bauteile ausgewählt.", typ: "err" }); return; }
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    try {
      const guids = await zuExternalIds(selektion);
      const arr = guids.filter(Boolean);
      if (!arr.length) { setMeldung({ text: "GUIDs konnten nicht gelesen werden.", typ: "err" }); return; }
      setTasks(tasks.map(t => t.id === taskId
        ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...arr])] } : t));
      setMeldung({ text: `✓ ${arr.length} Bauteile übernommen.`, typ: "ok" });
    } catch (e) {
      console.error("perKlick:", e);
      setMeldung({ text: "Fehler beim Übernehmen.", typ: "err" });
    }
  }

  if (!aktivesModellId) return (
    <div className="panel">
      <div className="alert warn">⚠ Kein Modell erkannt. Öffne "Modelle" Tab.</div>
    </div>
  );

  return (
    <div className="panel" ref={panelRef} onClick={() => { setShowKeyDrop(false); setShowValueDrop(false); }}>
      <div className="section-header">
        <span>Bauteile zuweisen</span>
        {selektion.length > 0 && (
          <span style={{ color: "var(--blue)", fontSize: 10 }}>● {selektion.length} ausgewählt</span>
        )}
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info-alert"}`}>
          {meldung.text}
        </div>
      )}

      {!tasks.length && <div className="empty-state"><p>Zuerst Gantt-Datei laden.</p></div>}

      {tasks.map(task => (
        <div key={task.id} className={`task-card ${aktiverTask === task.id ? "offen" : ""}`}>
          <div className="task-header" onClick={() => taskAnklicken(task.id)}>
            <span className={`typ-dot ${task.typ}`}>●</span>
            <span className="task-name">{task.name}</span>
            <div className="task-meta">
              <span className={`typ-badge ${task.typ}`}>{task.typ}</span>
              <span className="bauteil-count">
                {task.objektGuids.length > 0
                  ? <span style={{ color: "var(--blue)" }}>⬡ {task.objektGuids.length}</span>
                  : <span style={{ color: "#BDBDBD" }}>∅</span>}
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
                    <button key={typ}
                      className={`typ-btn ${task.typ === typ ? `aktiv-${typ}` : ""}`}
                      onClick={() => typAendern(task.id, typ)}>
                      {typ === "neubau" ? "🟢" : typ === "bestand" ? "🟡" : "🔴"} {typ}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-block">
                <div className="sub-label">
                  IFC-Attribut Filter
                  {attributeLaden && <span className="laden-text"> ⟳ Lade...</span>}
                  {Object.keys(attributMap).length > 0 && (
                    <span className="laden-text"> · {Object.keys(attributMap).length} Attribute</span>
                  )}
                </div>
                <div className="autocomplete-wrap" onClick={e => e.stopPropagation()}>
                  <input className="attr-input"
                    placeholder="Attributname (z.B. Geschoss, Type...)"
                    value={attributKey}
                    onChange={e => onKeyChange(e.target.value)}
                    onFocus={() => keyVorschlaege.length > 0 && setShowKeyDrop(true)} />
                  {showKeyDrop && (
                    <div className="dropdown">
                      {keyVorschlaege.map(k => (
                        <div key={k} className="dropdown-item"
                          onMouseDown={() => selectKey(k)}>{k}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="autocomplete-wrap" onClick={e => e.stopPropagation()}>
                  <input className="attr-input"
                    placeholder="Wert (z.B. OG1, Beton...)"
                    value={attributValue}
                    onChange={e => onValueChange(e.target.value)}
                    onFocus={() => valueVorschlaege.length > 0 && setShowValueDrop(true)} />
                  {showValueDrop && (
                    <div className="dropdown">
                      {valueVorschlaege.map(v => (
                        <div key={v} className="dropdown-item"
                          onMouseDown={() => { setAttributValue(v); setShowValueDrop(false); }}>{v}</div>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn-primary"
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden || !attributKey || !attributValue}>
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              <div className="detail-block">
                <div className="sub-label">Mausklick Zuweisung</div>
                <div className={`selektion-status ${selektion.length > 0 ? "aktiv" : ""}`}>
                  {selektion.length > 0
                    ? `✓ ${selektion.length} Bauteil(e) ausgewählt`
                    : "Bauteile im 3D Viewer anklicken"}
                </div>
                <button className="btn-secondary"
                  onClick={() => perKlickZuweisen(task.id)}
                  disabled={selektion.length === 0}>
                  ✓ Übernehmen ({selektion.length})
                </button>
              </div>

              {task.objektGuids.length > 0 && (
                <div className="detail-block">
                  <div className="sub-label-row">
                    <span>{task.objektGuids.length} Bauteile</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-xs"
                        onClick={() => markiereImViewer(task.objektGuids)}>
                        👁 Markieren
                      </button>
                      <button className="btn-xs danger"
                        onClick={() => setTasks(tasks.map(t =>
                          t.id === task.id ? { ...t, objektGuids: [] } : t))}>
                        🗑 Alle
                      </button>
                    </div>
                  </div>
                  <div className="guid-liste">
                    {task.objektGuids.map(guid => (
                      <div key={guid} className="guid-item">
                        <span className="guid-text">{guid.slice(0, 22)}...</span>
                        <button className="btn-remove"
                          onClick={() => setTasks(tasks.map(t =>
                            t.id === task.id
                              ? { ...t, objektGuids: t.objektGuids.filter(g => g !== guid) }
                              : t))}>✕</button>
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