import { useEffect, useState, useCallback } from "react";
import type { TcModel, TcSectionPlane, TcCamera } from "../types";

export interface PickInfo {
  position: { x: number; y: number; z: number } | null;
  normal: { x: number; y: number; z: number } | null;
  raw: any; // Roh-Daten für Debug
}

export interface ApiInstance {
  viewer: {
    getModels: () => Promise<TcModel[]>;
    getLoadedModel: () => Promise<TcModel[]>;
    getObjectBoundingBoxes: (modelId: string, ids: number[]) => Promise<any[]>;

    // Schnittebenen
    addSectionPlane: (plane: TcSectionPlane | TcSectionPlane[]) => Promise<TcSectionPlane[]>;
    getSectionPlanes: () => Promise<TcSectionPlane[]>;
    removeSectionPlanes: (ids?: number[]) => Promise<void>;

    // Section Box (Schnittfeld)
    addSectionBox: (box: any) => Promise<any>;
    removeSectionBox: () => Promise<void>;

    // Kamera
    getCamera: () => Promise<TcCamera>;
    setCamera: (camera: TcCamera | "reset", options?: { animationTime?: number }) => Promise<void>;

    // Snapshot
    getSnapshot: () => Promise<string>;

    onSelectionChanged: {
      addListener: (cb: (event: any) => void) => void;
      removeListener: (cb: (event: any) => void) => void;
    };
    onModelStateChanged?: {
      addListener: (cb: (event: any) => void) => void;
      removeListener: (cb: (event: any) => void) => void;
    };
    onPicked?: {
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
  letzterPick: PickInfo | null;
}

export function useApi(): UseApiReturn {
  const [api, setApi] = useState<ApiInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktivesModellId, setAktivesModellId] = useState<string | null>(null);
  const [geladeneModelle, setGeladeneModelle] = useState<{ id: string; name: string }[]>([]);
  const [letzterPick, setLetzterPick] = useState<PickInfo | null>(null);

  const handlePick = useCallback((data: any) => {
    console.log("[Skizzentool] onPicked raw:", JSON.stringify(data));
    const pick: PickInfo = {
      position: data?.position ?? data?.point ?? null,
      normal: data?.normal ?? null,
      raw: data,
    };
    setLetzterPick(pick);
  }, []);

  useEffect(() => {
    let apiInst: ApiInstance | null = null;

    async function warteAufWorkspaceApi(): Promise<any> {
      for (let i = 0; i < 20; i++) {
        const wapi = (window as any).TrimbleConnectWorkspace;
        if (wapi) return wapi;
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    }

    async function init() {
      try {
        const wapi = await warteAufWorkspaceApi();
        if (!wapi) {
          setFehler("TC Workspace API nicht gefunden (10s Timeout)");
          return;
        }

        apiInst = (await wapi.connect(window.parent, (event: string, args: any) => {
          // Globaler Event-Handler — fängt ALLE TC-Events
          if (event === "viewer.onPicked") {
            handlePick(args?.data);
          }
        })) as ApiInstance;
        setApi(apiInst);

        // Auch über den spezifischen Listener versuchen
        try {
          apiInst.viewer.onPicked?.addListener((event: any) => {
            handlePick(event?.data ?? event);
          });
        } catch { /* onPicked listener nicht verfügbar */ }

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
  }, [handlePick]);

  return { api, ready, fehler, aktivesModellId, geladeneModelle, letzterPick };
}
