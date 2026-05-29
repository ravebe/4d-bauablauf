import { useState, useEffect, useRef } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

export interface Modell {
  id: string;
  name: string;
}

export interface ViewerState {
  selektion: number[];
  aktivesModellId: string;
  modelle: Modell[];
}

export function useApi() {
  const [api, setApi] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [viewerState, setViewerState] = useState<ViewerState>({
    selektion: [],
    aktivesModellId: "",
    modelle: [],
  });
  const apiRef = useRef<any>(null);

  function parseSelektionIds(data: any): number[] {
    console.log("parseSelektionIds input:", JSON.stringify(data));
    if (!data) return [];

    let arr: any[] = [];
    if (Array.isArray(data)) arr = data;
    else if (Array.isArray(data?.data)) arr = data.data;
    else if (Array.isArray(data?.selection)) arr = data.selection;
    else if (Array.isArray(data?.objects)) arr = data.objects;
    else {
      console.log("Unbekanntes Format:", typeof data, data);
      return [];
    }

    const ids: number[] = [];
    for (const item of arr) {
      if (typeof item === "number") { ids.push(item); continue; }
      if (typeof item === "object" && item !== null) {
        const kandidaten = [
          item.id, item.entityId, item.runtimeId,
          item.objectRuntimeId, item.objectId,
        ];
        for (const k of kandidaten) {
          if (k != null && !isNaN(Number(k))) { ids.push(Number(k)); break; }
        }
      }
    }
    console.log("Parsed IDs:", ids);
    return ids;
  }

  async function ladeModelle(instance: any): Promise<Modell[]> {
    try {
      const result = await instance.viewer.getModels();
      console.log("getModels result:", JSON.stringify(result));
      const rohe = Array.isArray(result) ? result : [];
      return rohe.map((m: any) => ({
        id: m.modelId || m.id || String(m),
        name: m.name || m.fileName || m.modelName || "Modell",
      }));
    } catch (e) {
      console.warn("ladeModelle Fehler:", e);
      return [];
    }
  }

  useEffect(() => {
    async function connect() {
      try {
        const instance = await WorkspaceAPI.connect(
          window.parent,
          async (event: string, data: any) => {
            console.log("TC Event:", event, "Data:", JSON.stringify(data));

            if (event === "viewer.onSelectionChanged") {
              const ids = parseSelektionIds(data);
              setViewerState(prev => ({ ...prev, selektion: ids }));
            }

            if (
              event === "viewer.onModelLoaded" ||
              event === "viewer.onModelsLoaded" ||
              event === "viewer.onModelAdded"
            ) {
              const modelle = await ladeModelle(apiRef.current);
              setViewerState(prev => ({
                ...prev,
                modelle,
                aktivesModellId: modelle.length > 0 ? modelle[0].id : prev.aktivesModellId,
              }));
            }
          },
          30000
        );

        apiRef.current = instance;

        try {
          await instance.ui.setMenu({
            title: "4D Bauablauf",
            icon: "https://project-fb9pr-red.vercel.app/icons.svg",
            command: "open",
          });
        } catch (e) {
          console.warn("setMenu:", e);
        }

        const modelle = await ladeModelle(instance);
        setViewerState(prev => ({
          ...prev,
          modelle,
          aktivesModellId: modelle.length > 0 ? modelle[0].id : "",
        }));

        setApi(instance);
        setConnected(true);
      } catch (err) {
        console.error("Verbindung fehlgeschlagen:", err);
        setConnected(false);
      }
    }
    connect();
  }, []);

  return { api, connected, viewerState, setViewerState };
}