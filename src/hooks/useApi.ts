import { useEffect, useState } from "react";
import type { TcModel, TcSectionPlane, TcCamera } from "../types";

export interface ApiInstance {
  viewer: {
    getModels: () => Promise<TcModel[]>;
    getLoadedModel: () => Promise<TcModel[]>;
    getObjectBoundingBoxes: (modelId: string, ids: number[]) => Promise<any[]>;

    // Schnittebenen
    addSectionPlane: (plane: TcSectionPlane | TcSectionPlane[]) => Promise<TcSectionPlane[]>;
    getSectionPlanes: () => Promise<TcSectionPlane[]>;
    removeSectionPlanes: (ids?: number[]) => Promise<void>;

    // Section Box (Bereich begrenzen)
    addSectionBox: (box: any) => Promise<any>;
    removeSectionBox: () => Promise<void>;

    // Kamera
    getCamera: () => Promise<TcCamera>;
    setCamera: (camera: TcCamera | "reset", options?: { animationTime?: number }) => Promise<void>;

    // Snapshot
    getSnapshot: () => Promise<string>; // Data-URL: "data:image/png;base64,..."

    onSelectionChanged: {
      addListener: (cb: (event: any) => void) => void;
      removeListener: (cb: (event: any) => void) => void;
    };
    onModelStateChanged?: {
      addListener: (cb: (event: any) => void) => void;
      removeListener: (cb: (event: any) => void) => void;
    };
  };
  extension: { requestPermission: (type: string) => Promise<string>; };
  project: { getProject: () => Promise<{ id: string; name: string }>; };
}

interface UseApiReturn {
  api: ApiInstance | null;
  ready: boolean;
  fehler: string | null;
  aktivesModellId: string | null;
  geladeneModelle: { id: string; name: string }[];
}

export function useApi(): UseApiReturn {
  const [api, setApi] = useState<ApiInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktivesModellId, setAktivesModellId] = useState<string | null>(null);
  const [geladeneModelle, setGeladeneModelle] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let apiInst: ApiInstance | null = null;

    async function init() {
      try {
        let wapi = (window as any).TrimbleConnectWorkspace;
        if (!wapi) {
          await new Promise(r => setTimeout(r, 1500));
          wapi = (window as any).TrimbleConnectWorkspace;
        }
        if (!wapi) {
          setFehler("TC Workspace API nicht gefunden");
          return;
        }

        apiInst = (await wapi.connect(window.parent, () => {})) as ApiInstance;
        setApi(apiInst);

        const ladeModelle = async () => {
          for (let i = 0; i < 8; i++) {
            try {
              const geladen = await apiInst!.viewer.getLoadedModel() as any;
              const arr = Array.isArray(geladen) ? geladen : geladen ? [geladen] : [];
              if (arr.length > 0) {
                setAktivesModellId(arr[0].id || arr[0].modelId);
                setGeladeneModelle(arr.map((m: any) => ({
                  id: m.id || m.modelId,
                  name: m.name || m.fileName || m.id
                })));
                return;
              }
            } catch { /* ignore */ }
            try {
              const modelle = await apiInst!.viewer.getModels() as any[];
              const geladen = modelle.filter((m: any) => m.state === 'loaded');
              if (geladen.length > 0) {
                setAktivesModellId(geladen[0].id || geladen[0].modelId);
                setGeladeneModelle(geladen.map((m: any) => ({
                  id: m.id || m.modelId,
                  name: m.name || m.fileName || m.id
                })));
                return;
              }
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, i === 0 ? 0 : 100));
          }
        };
        ladeModelle();

        try {
          (apiInst.viewer as any).onModelStateChanged?.addListener((event: any) => {
            const data = event?.data;
            if (data?.state === 'loaded' && (data?.id || data?.modelId)) {
              setAktivesModellId(data.id || data.modelId);
            }
          });
        } catch { /* ignore */ }

        setReady(true);
        setFehler(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setFehler(`API Init Fehler: ${msg}`);
      }
    }

    init();
  }, []);

  return { api, ready, fehler, aktivesModellId, geladeneModelle };
}
