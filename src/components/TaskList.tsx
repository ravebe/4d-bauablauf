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
      const roheObjekte = await api.viewer.getObjects(aktivesModellId);
      console.log("getObjects result:", roheObjekte);

      let objIds: string[] = [];
      if (Array.isArray(roheObjekte)) {
        objIds = roheObjekte.slice(0, 100).map((o: any) => {
          if (typeof o === "string") return o;
          if (o?.id) return String(o.id);
          if (o?.objectId) return String(o.objectId);
          return null;
        }).filter(Boolean) as string[];
      }

      if (objIds.length === 0) {
        console.warn("Keine Objekt-IDs gefunden");
        setAttributeLaden(false);
        return;
      }

      console.log("Lade Properties für", objIds.length, "Objekte");
      const roheProps = await api.viewer.getObjectProperties(aktivesModellId, objIds);
      console.log("getObjectProperties result:", roheProps);

      const props = Array.isArray(roheProps) ? roheProps : [];
      const map: AttributMap = {};

      for (const obj of props) {
        if (!obj) continue;
        const gruppen = Array.isArray(obj.properties) ? obj.properties : [];
        for (const gruppe of gruppen) {
          if (!gruppe) continue;
          const propListe = Array.isArray(gruppe.properties) ? gruppe.properties : [];
          for (const prop of propListe) {
            if (!prop?.name) continue;
            if (!map[prop.name]) map[prop.name] = new Set();
            if (prop.value != null) map[prop.name].add(String(prop.value));
          }
        }
      }

      console.log("AttributMap Schlüssel:", Object.keys(map).length);
      setAttributMap(map);
    } catch (err) {
      console.error("ladeAttribute Fehler:", err);
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
      console.log("markiere runtimeIds:", runtimeIds);
      await api.viewer.setSelection(runtimeIds);
    } catch (e) { console.warn("Markierung Fehler:", e); }
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
      const ids: string[] = objekte.map((o: any) => {
        if (typeof o === "string") return o;
        if (o?.id) return String(o.id);
        return null;
      }).filter(Boolean) as string[];

      if (ids.length === 0) {
        setMeldung({ text: "Keine Objekte im Modell gefunden.", typ: "err" });
        setLaden(false);
        return;
      }

      const roheEigen = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const eigenschaften = Array.isArray(roheEigen) ? roheEigen : [];
      const gefundeneGuids: string[] = [];

      for (const obj of eigenschaften) {
        if (!obj?.id) continue;
        let gefunden = false;
        for (const gruppe of (obj.properties ?? [])) {
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
      console.error("perAttributZuweisen Fehler:", err);
      setMeldung({ text: "Fehler bei der Suche. Details in der Konsole.", typ: "err" });
    } finally {
      setLaden(false);
    }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    if (!selektion || selektion.length === 0) {
      setMeldung({ text: "Keine Bauteile ausgewählt.", typ: "err" });
      return;
    }

    console.log("perKlickZuweisen selektion:", selektion);
    try {
      const guids = await api.viewer.convertToObjectIds(aktivesModellId, selektion);
      console.log("convertToObjectIds result:", guids);
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
      console.error("perKlickZuweisen Fehler:", err);
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
          <span style={{ color: "#0a84ff", fontSize: 10 }}>● {selektion.length} ausgewählt</span>
        )}
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info-alert"}`}>
          {meldung.text}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="empty-state"><p>Bitte zuerst eine Gantt-Datei laden.</p></div>
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
                  {Object.keys(attributMap).length > 0 && (
                    <span className="laden-text"> · {Object.keys(attributMap).length} Attribute</span>
                  )}
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
                        <div key={v} className="dropdown-item"
                          onClick={() => { setAttributValue(v); setShowValueDrop(false); }}>
                          {v}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="btn-primary"
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden || !attributKey || !attributValue}
                >
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              <div className="detail-block">
                <div className="sub-label">Mausklick Zuweisung</div>
                <div className={`selektion-status ${selektion.length > 0 ? "aktiv" : ""}`}>
                  {selektion.length > 0
                    ? `✓ ${selektion.length} Bauteil(e) ausgewählt`
                    : "Im 3D Viewer Bauteile anklicken"}
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => perKlickZuweisen(task.id)}
                  disabled={selektion.length === 0}
                >
                  ✓ Übernehmen ({selektion.length})
                </button>
              </div>

              {task.objektGuids.length > 0 && (
                <div className="detail-block">
                  <div className="sub-label-row">
                    <span>{task.objektGuids.length} Bauteile</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-xs" onClick={() => markiereImViewer(task.objektGuids)}>
                        👁 Markieren
                      </button>
                      <button className="btn-xs danger" onClick={() => alleEntfernen(task.id)}>
                        🗑 Alle
                      </button>
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