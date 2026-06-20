import { useApi } from "./hooks/useApi";
import TabSchnitt from "./components/TabSchnitt";
import "./App.css";

export default function App() {
  const { api, ready, fehler, aktivesModellId, letzterPick, aktuelleBox } = useApi();

  return (
    <div className="tc-app">
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-logo">✂</div>
          <span className="tc-header-title">Skizzentool</span>
        </div>
        <div className="tc-header-right">
          <span className={`tc-dot ${ready ? "on" : "off"}`} title={ready ? "Verbunden" : fehler ?? "Verbinde…"} />
        </div>
      </div>

      {fehler && (
        <div style={{ padding: 8, fontSize: 11, color: "#b00", background: "#fff0f0", borderBottom: "1px solid #fcc" }}>
          ⚠ {fehler}
        </div>
      )}

      <div className="tc-tab-content">
        <TabSchnitt
          api={api}
          aktivesModellId={aktivesModellId}
          letzterPick={letzterPick}
          aktuelleBox={aktuelleBox}
        />
      </div>
    </div>
  );
}
