import { useState, useEffect, useRef } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

export interface Modell {
  id: string;
  name: string;
  fileId?: string;
  fileVersionId?: string;
}

export interface ViewerState {
  selektion: number[];
  aktivesModellId: string;
  modelle: Modell[];
}

function parseIds(data: any): number[] {
  if (!data) return [];
  let arr: any[] = [];
  if (Array.isArray(data)) arr = data;
  else if (Array.isArray(data?.data)) arr = data.data;
  else if (Array.isArray(data?.selection)) arr = data.selection;
  else if (Array.isArray(data?.objects)) arr = data.objects;
  else return [];

  return arr
    .map((x: any) => {
      if (typeof x === "number") return x;
      if (x == null) return null;
      for (const k of ["id", "entityId", "runtimeId", "objectRuntimeId", "objectId"]) {
        if (x[k] != null) return Number(x[k]);
      }
      return null;
    })
    .filter((x): x is number => x !== null && !isNaN(x) && x >= 0);
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

  async function ladeModelle(instance: any): Promise<Modell[]> {
    try {
      const res = await instance.viewer.getModels();
      console.log("getModels:", JSON.stringify(res));
      const arr = Array.isArray(res) ? res : [];
      return arr.map((m: any) => ({
        id: m.modelId || m.id || "",
        name: m.name || m.fileName || m.modelName || "Modell",
        fileId: m.fileId || m.file?.id,
        fileVersionId: m.fileVersionId || m.file?.versionId,
      })).filter(m => m.id);
    } catch (e) {
      console.warn("ladeModelle:", e);
      return [];
    }
  }

  useEffect(() => {
    async function connect() {
      try {
        const instance = await WorkspaceAPI.connect(
          window.parent,
          async (event: string, data: any) => {
            console.log("TC:", event, JSON.stringify(data)?.slice(0, 120));

            if (event === "viewer.onSelectionChanged") {
              const ids = parseIds(data);
              console.log("Selektion IDs:", ids);
              setViewerState(prev => ({ ...prev, selektion: ids }));
            }

            if (["viewer.onModelLoaded", "viewer.onModelsLoaded", "viewer.onModelAdded"].includes(event)) {
              const modelle = await ladeModelle(apiRef.current);
              setViewerState(prev => ({
                ...prev,
                modelle,
                aktivesModellId: modelle.length > 0
                  ? (prev.aktivesModellId && modelle.find(m => m.id === prev.aktivesModellId)
                    ? prev.aktivesModellId
                    : modelle[0].id)
                  : "",
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
        } catch (e) { console.warn("setMenu:", e); }

        const modelle = await ladeModelle(instance);
        setViewerState(prev => ({
          ...prev,
          modelle,
          aktivesModellId: modelle.length > 0 ? modelle[0].id : "",
        }));

        setApi(instance);
        setConnected(true);
      } catch (err) {
        console.error("connect:", err);
        setConnected(false);
      }
    }
    connect();
  }, []);

  return { api, connected, viewerState, setViewerState };
}