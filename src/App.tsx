import { useApi } from "./hooks/useApi";
import TabSchnitt from "./components/TabSchnitt";
import "./App.css";

export default function App() {
  const { api, ready, fehler, aktivesModellId, geladeneModelle } = useApi();

  return (
    <div className="tc-app">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-logo">✂</div>
          <span className="tc-header-title">Schnitt-Tool</span>
        </div>
        <div className="tc-header-right">
          <span className={`tc-dot ${ready ? "on" : "off"}`} title={ready ? "Verbunden" : fehler ?? "Verbinde…"} />
        </div>
      </div>

      {/* Tab Content */}
      <div className="tc-tab-content">
        <TabSchnitt
          api={api}
          aktivesModellId={aktivesModellId}
          geladeneModelle={geladeneModelle}
        />
      </div>
    </div>
  );
}
