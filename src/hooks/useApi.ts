import { useState, useEffect, useRef } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

export interface ViewerState {
  selektion: number[];        // aktuelle Runtime IDs
  aktivesModellId: string;    // aktuell geladenes Modell
  modelle: { id: string; name: string }[];
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

  useEffect(() => {
    async function connect() {
      try {
        const instance = await WorkspaceAPI.connect(
          window.parent,
          async (event: string, data: any) => {
            const currentApi = apiRef.current;
            console.log("TC Event:", event, data);

            // Selektion geändert
            if (event === "viewer.onSelectionChanged") {
              const raw = data?.data ?? data ?? [];
              const ids: number[] = Array.isArray(raw)
                ? raw.map((x: any) => typeof x === "number" ? x : Number(x?.id ?? x?.entityId ?? x?.runtimeId ?? -1)).filter((x: number) => x >= 0)
                : [];
              setViewerState(prev => ({ ...prev, selektion: ids }));
            }

            // Modell geladen
            if (event === "viewer.onModelLoaded" || event === "viewer.onModelsLoaded") {
              if (currentApi) await ladeModelle(currentApi);
            }
          },
          30000
        );

        apiRef.current = instance;

        await instance.ui.setMenu({
          title: "4D Bauablauf",
          icon: "https://project-fb9pr-red.vercel.app/icons.svg",
          command: "open",
        });

        // Modelle initial laden
        await ladeModelle(instance);

        setApi(instance);
        setConnected(true);
      } catch (err) {
        console.error("Verbindung fehlgeschlagen:", err);
        setConnected(false);
      }
    }

    async function ladeModelle(instance: any) {
      try {
        const result = await instance.viewer.getModels();
        const rohe = Array.isArray(result) ? result : [];
        const modelle = rohe.map((m: any) => ({
          id: m.modelId || m.id || String(m),
          name: m.name || m.fileName || "Modell",
        }));
        setViewerState(prev => ({
          ...prev,
          modelle,
          aktivesModellId: modelle.length > 0 ? modelle[0].id : prev.aktivesModellId,
        }));
      } catch (e) {
        console.warn("Modelle laden:", e);
      }
    }

    connect();
  }, []);

  return { api, connected, viewerState, setViewerState };
}