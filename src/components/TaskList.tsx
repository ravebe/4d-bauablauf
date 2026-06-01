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

interface PsetAttribut {
  pset: string;
  name: string;
  key: string; // "pset||name"
}

interface AttributMap {
  [key: string]: Set<string>; // key = "pset||name"
}

export default function TaskList({ tasks, setTasks, api, viewerState }: Props) {
  const { selektion, aktivesModellId } = viewerState;
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [selectedAttr, setSelectedAttr] = useState<PsetAttribut | null>(null);
  const [attributValue, setAttributValue] = useState("");
  const [laden, setLaden] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; typ: "ok" | "err" | "info" } | null>(null);
  const [attributMap, setAttributMap] = useState<AttributMap>({});
  const [allAttrs, setAllAttrs] = useState<PsetAttribut[]>([]);
  const [attributeLaden, setAttributeLaden] = useState(false);
  const [attrSuche, setAttrSuche] = useState("");
  const [valueVorschlaege, setValueVorschlaege] = useState<string[]>([]);
  const [showAttrDrop, setShowAttrDrop] = useState(false);
  const [showValueDrop, setShowValueDrop] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const BATCH = 10;

  async function getPropertiesBatch(runtimeIds: number[]): Promise<any[]> {
    const alle: any[] = [];
    for (let i = 0; i < runtimeIds.length; i += BATCH) {
      const batch = runtimeIds.slice(i, i + BATCH);
      try {
        const result = await api.viewer.getObjectProperties(aktivesModellId, batch);
        if (Array.isArray(result)) alle.push(...result);
      } catch (e) { console.warn("batch fehler:", e); }
    }
    return alle;
  }

  async function ladeAttribute() {
    if (!api || !aktivesModellId) return;
    setAttributeLaden(true);
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      const runtimeIds = parseObjectIds(rohe).slice(0, 50); // nur 50 für Attribute
      if (!runtimeIds.length) { setAttributeLaden(false); return; }

      const props = await getPropertiesBatch(runtimeIds);
      const map: AttributMap = {};
      const attrsSet = new Map<string, PsetAttribut>();

      for (const obj of props) {
        for (const g of (obj?.properties || [])) {
          const psetName = g?.name || g?.displayName || "Eigenschaften";
          for (const p of (g?.properties || [])) {
            if (!p?.name) continue;
            const key = `${psetName}||${p.name}`;
            if (!map[key]) {
              map[key] = new Set();
              attrsSet.set(key, { pset: psetName, name: p.name, key });
            }
            if (p.value != null) map[key].add(String(p.value));
          }
        }
      }
      setAttributMap(map);
      setAllAttrs([...attrsSet.values()]);
      console.log("✅ Attribute:", attrsSet.size, "PSet-Attribut Paare");
    } catch (e) { console.error("ladeAttribute:", e); }
    finally { setAttributeLaden(false); }
  }

  function gefilterteAttrs(): PsetAttribut[] {
    if (!attrSuche) return allAttrs.slice(0, 10);
    return allAttrs.filter(a =>
      a.name.toLowerCase().includes(attrSuche.toLowerCase()) ||
      a.pset.toLowerCase().includes(attrSuche.toLowerCase())
    ).slice(0, 10);
  }

  function selectAttr(attr: PsetAttribut) {
    setSelectedAttr(attr);
    setAttrSuche(`${attr.pset} › ${attr.name}`);
    setShowAttrDrop(false);
    setAttributValue("");
    const werte = attributMap[attr.key] ? [...attributMap[attr.key]].slice(0, 15) : [];
    setValueVorschlaege(werte);
    setShowValueDrop(werte.length > 0);
  }

  function typAendern(id: string, typ: TaskTyp) {
    setTasks(tasks.map(t => t.id === id ? { ...t, typ } : t));
  }

  async function markiereImViewer(guids: string[]) {
    if (!api || !aktivesModellId || !guids.length) return;
    try {
      const nums = guids.map(Number).filter(n => !isNaN(n) && n >= 0);
      if (nums.length === guids.length) {
        await api.viewer.setSelection(nums);
      } else {
        const ids = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, guids);
        await api.viewer.setSelection(ids);
      }
    } catch (e) { console.warn("markiere:", e); }
  }

  async function taskAnklicken(taskId: string) {
    const neu = aktiverTask === taskId ? null : taskId;
    setAktiverTask(neu); setMeldung(null);
    setAttrSuche(""); setSelectedAttr(null); setAttributValue("");
    setShowAttrDrop(false); setShowValueDrop(false);
    if (neu) {
      if (!allAttrs.length) ladeAttribute();
      const t = tasks.find(x => x.id === taskId);
      if (t?.objektGuids.length) markiereImViewer(t.objektGuids);
    }
  }

  async function perAttributZuweisen(taskId: string) {
    if (!selectedAttr || !attributValue.trim()) {
      setMeldung({ text: "Bitte Attribut und Wert auswählen.", typ: "err" }); return;
    }
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    setLaden(true);
    setMeldung({ text: "⟳ Suche Bauteile...", typ: "info" });
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      const alleRuntimeIds = parseObjectIds(rohe);
      if (!alleRuntimeIds.length) { setMeldung({ text: "Keine Objekte gefunden.", typ: "err" }); setLaden(false); return; }

      const props = await getPropertiesBatch(alleRuntimeIds);
      const gefundeneRuntimeIds: number[] = [];

      for (const obj of props) {
        const rId = Number(obj?.id);
        if (isNaN(rId)) continue;
        let hit = false;
        for (const g of (obj?.properties || [])) {
          if (hit) break;
          const psetName = g?.name || g?.displayName || "Eigenschaften";
          // Nur im richtigen PSet suchen
          if (psetName !== selectedAttr.pset) continue;
          for (const p of (g?.properties || [])) {
            if (hit) break;
            if (p?.name === selectedAttr.name) {
              const val = String(p?.value ?? "").trim();
              const suchVal = attributValue.trim();
              // Exakter Match ODER enthält (je nach Länge)
              if (val === suchVal || val.toLowerCase().includes(suchVal.toLowerCase())) {
                gefundeneRuntimeIds.push(rId);
                hit = true;
              }
            }
          }
        }
      }

      if (!gefundeneRuntimeIds.length) {
        setMeldung({ text: `Keine Bauteile mit ${selectedAttr.name} = "${attributValue}" gefunden.`, typ: "err" });
        setLaden(false); return;
      }

      await api.viewer.setSelection(gefundeneRuntimeIds);
      const guids = gefundeneRuntimeIds.map(String);
      setTasks(tasks.map(t => t.id === taskId
        ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guids])] } : t));
      setMeldung({ text: `✓ ${gefundeneRuntimeIds.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (e) {
      console.error("perAttr:", e);
      setMeldung({ text: "Fehler bei Suche.", typ: "err" });
    } finally { setLaden(false); }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!selektion.length) { setMeldung({ text: "Keine Bauteile ausgewählt.", typ: "err" }); return; }
    const guids = selektion.map(String);
    setTasks(tasks.map(t => t.id === taskId
      ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guids])] } : t));
    setMeldung({ text: `✓ ${guids.length} Bauteile übernommen.`, typ: "ok" });
  }

  if (!aktivesModellId) return (
    <div className="panel">
      <div className="alert warn">⚠ Kein Modell aktiv.</div>
    </div>
  );

  return (
    <div className="panel" ref={panelRef} onClick={() => { setShowAttrDrop(false); setShowValueDrop(false); }}>
      <div className="section-header">
        <span>Bauteile zuweisen</span>
        {selektion.length > 0 && <span style={{ color: "var(--blue)", fontSize: 10 }}>● {selektion.length} ausgewählt</span>}
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info-alert"}`}>
          {meldung.text}
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
                    <button key={typ} className={`typ-btn ${task.typ === typ ? `aktiv-${typ}` : ""}`}
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
                  {allAttrs.length > 0 && <span className="laden-text"> · {allAttrs.length} Attribute</span>}
                </div>

                {/* Attribut Suche mit PSet Anzeige */}
                <div className="autocomplete-wrap" onClick={e => e.stopPropagation()}>
                  <input
                    className="attr-input"
                    placeholder="PSet oder Attribut suchen..."
                    value={attrSuche}
                    onChange={e => {
                      setAttrSuche(e.target.value);
                      setSelectedAttr(null);
                      setShowAttrDrop(true);
                    }}
                    onFocus={() => setShowAttrDrop(true)}
                  />
                  {showAttrDrop && gefilterteAttrs().length > 0 && (
                    <div className="dropdown">
                      {gefilterteAttrs().map(a => (
                        <div key={a.key} className="dropdown-item" onMouseDown={() => selectAttr(a)}>
                          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{a.pset} › </span>
                          <strong>{a.name}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Wert */}
                <div className="autocomplete-wrap" onClick={e => e.stopPropagation()}>
                  <input
                    className="attr-input"
                    placeholder="Wert eingeben oder auswählen..."
                    value={attributValue}
                    disabled={!selectedAttr}
                    onChange={e => {
                      setAttributValue(e.target.value);
                      if (selectedAttr) {
                        const w = [...(attributMap[selectedAttr.key] || [])]
                          .filter(v => v.toLowerCase().includes(e.target.value.toLowerCase()))
                          .slice(0, 10);
                        setValueVorschlaege(w);
                        setShowValueDrop(w.length > 0);
                      }
                    }}
                    onFocus={() => valueVorschlaege.length > 0 && setShowValueDrop(true)}
                  />
                  {showValueDrop && valueVorschlaege.length > 0 && (
                    <div className="dropdown">
                      {valueVorschlaege.map(v => (
                        <div key={v} className="dropdown-item"
                          onMouseDown={() => { setAttributValue(v); setShowValueDrop(false); }}>
                          {v}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button className="btn-primary"
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden || !selectedAttr || !attributValue.trim()}>
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              <div className="detail-block">
                <div className="sub-label">Mausklick Zuweisung</div>
                <div className={`selektion-status ${selektion.length > 0 ? "aktiv" : ""}`}>
                  {selektion.length > 0 ? `✓ ${selektion.length} Bauteil(e) ausgewählt` : "Im 3D Viewer anklicken"}
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
                      <button className="btn-xs" onClick={() => markiereImViewer(task.objektGuids)}>👁 Markieren</button>
                      <button className="btn-xs danger"
                        onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, objektGuids: [] } : t))}>
                        🗑 Alle
                      </button>
                    </div>
                  </div>
                  <div className="guid-liste">
                    {task.objektGuids.map(guid => (
                      <div key={guid} className="guid-item">
                        <span className="guid-text">{guid.slice(0, 22)}...</span>
                        <button className="btn-remove"
                          onClick={() => setTasks(tasks.map(t => t.id === task.id
                            ? { ...t, objektGuids: t.objektGuids.filter(g => g !== guid) } : t))}>✕</button>
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