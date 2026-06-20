import { useEffect, useState, useCallback } from "react";
import type { TcModel, TcSectionBox, TcCamera } from "../types";

/** Pick-Info: Position + Normale aus onPicked-Event */
export interface PickInfo {
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number } | null;
  objectRuntimeId?: number;
  modelId?: string;
}

export interface ApiInstance {
  viewer: {
    getModels: () => Promise<TcModel[]>;
    getLoadedModel: () => Promise<TcModel[]>;

    // Tools
    activateTool: (name: string, options?: Record<string, unknown>) => Promise<void>;

    // Section Box
    addSectionBox: (box: TcSectionBox) => Promise<TcSectionBox>;
    removeSectionBox: () => Promise<void>;
    selectSectionBox: () => Promise<void>;
    deSelectSectionBox: () => Promise<void>;

    // Section Planes
    removeSectionPlanes: (ids?: number[]) => Promise<void>;

    // Kamera
    getCamera: () => Promise<TcCamera>;
    setCamera: (camera: TcCamera | "reset", options?: { animationTime?: number }) => Promise<void>;

    // Snapshot
    getSnapshot: () => Promise<string>;

    // Events
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
  letzterPick: PickInfo | null;
  aktuelleBox: TcSectionBox | null;
}

export function useApi(): UseApiReturn {
  const [api, setApi] = useState<ApiInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktivesModellId, setAktivesModellId] = useState<string | null>(null);
  const [letzterPick, setLetzterPick] = useState<PickInfo | null>(null);
  const [aktuelleBox, setAktuelleBox] = useState<TcSectionBox | null>(null);

  const handlePick = useCallback((data: any) => {
    if (!data?.position) return;
    console.log("[Skizzentool] onPicked:", JSON.stringify(data));
    setLetzterPick({
      position: data.position,
      normal: data.normal ?? null,
      objectRuntimeId: data.objectRuntimeId,
      modelId: data.modelId,
    });
  }, []);

  const handleSectionBoxChanged = useCallback((data: any) => {
    console.log("[Skizzentool] onSectionBoxChanged:", JSON.stringify(data));
    if (data && typeof data.positionX === "number") {
      setAktuelleBox(data as TcSectionBox);
    }
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
          if (event === "viewer.onPicked") {
            handlePick(args?.data);
          }
          if (event === "viewer.onSectionBoxChanged") {
            handleSectionBoxChanged(args?.data);
          }
        })) as ApiInstance;
        setApi(apiInst);

        // Auch spezifische Listener versuchen
        try {
          apiInst.viewer.onPicked?.addListener((event: any) => {
            handlePick(event?.data ?? event);
          });
        } catch { /* nicht verfügbar */ }

        // Modelle laden
        const ladeModelle = async () => {
          for (let i = 0; i < 8; i++) {
            try {
              const geladen = await apiInst!.viewer.getLoadedModel() as any;
              const arr = Array.isArray(geladen) ? geladen : geladen ? [geladen] : [];
              if (arr.length > 0) {
                setAktivesModellId(arr[0].id || arr[0].modelId);
                return;
              }
            } catch { /* ignore */ }
            try {
              const modelle = await apiInst!.viewer.getModels() as any[];
              const geladen = modelle.filter((m: any) => m.state === "loaded");
              if (geladen.length > 0) {
                setAktivesModellId(geladen[0].id || geladen[0].modelId);
                return;
              }
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, i === 0 ? 0 : 100));
          }
        };
        ladeModelle();

        try {
          (apiInst.viewer as any).onModelStateChanged?.addListener((event: any) => {
            const d = event?.data;
            if (d?.state === "loaded" && (d?.id || d?.modelId)) {
              setAktivesModellId(d.id || d.modelId);
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
  }, [handlePick, handleSectionBoxChanged]);

  return { api, ready, fehler, aktivesModellId, letzterPick, aktuelleBox };
}
