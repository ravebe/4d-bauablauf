import { useState, useEffect, useRef } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

export interface Modell {
  id: string;
  name: string;
  fileId?: string;
}

export interface ViewerState {
  selektion: number[];
  aktivesModellId: string;
  modelle: Modell[];
}

function parseIds(data: any): number[] {
  if (!data) return [];
  const outer = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const ids: number[] = [];
  for (const item of outer) {
    if (Array.isArray(item?.objectRuntimeIds)) {
      for (const id of item.objectRuntimeIds) {
        const n = Number(id);
        if (!isNaN(n) && n >= 0) ids.push(n);
      }
      continue;
    }
    if (typeof item === "number") { ids.push(item); continue; }
    if (item != null && typeof item === "object") {
      for (const k of ["id", "entityId", "runtimeId", "objectRuntimeId"]) {
        if (item[k] != null) { const n = Number(item[k]); if (!isNaN(n)) { ids.push(n); break; } }
      }
    }
  }
  return ids;
}

export function parseObjectIds(rohe: any): number[] {
  if (!Array.isArray(rohe)) return [];
  const ids: number[] = [];
  for (const item of rohe) {
    if (Array.isArray(item?.objects)) {
      for (const o of item.objects) {
        const n = Number(o?.id ?? o);
        if (!isNaN(n)) ids.push(n);
      }
    } else if (typeof item === "number") {
      ids.push(item);
    } else if (item?.id != null) {
      const n = Number(item.id);
      if (!isNaN(n)) ids.push(n);
    }
  }
  return ids;
}

export function useApi() {
  const [api, setApi] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [isViewerContext, setIsViewerContext] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [viewerState, setViewerState] = useState<ViewerState>({
    selektion: [],
    aktivesModellId: "",
    modelle: [],
  });
  const apiRef = useRef<any>(null);

  async function ladeModelle(instance: any): Promise<Modell[]> {
    try {
      const res = await instance.viewer.getModels();
      const arr = Array.isArray(res) ? res : [];
      return arr.map((m: any) => ({
        id: m.modelId || m.id || "",
        name: m.name || m.fileName || "Modell",
        fileId: m.fileId || m.file?.id,
      })).filter((m: Modell) => m.id);
    } catch { return []; }
  }

  useEffect(() => {
    async function connect() {
      try {
        const instance = await WorkspaceAPI.connect(
          window.parent,
          async (event: string, data: any) => {
            console.log("TC:", event, JSON.stringify(data)?.slice(0, 150));

            if (event === "viewer.onSelectionChanged") {
              const ids = parseIds(data);
              setViewerState(prev => ({ ...prev, selektion: ids }));
            }

            if (event === "extension.accessToken") {
              const token = (data as any)?.data || data;
              if (typeof token === "string" && token.length > 10) {
                setAccessToken(token);
              }
            }

            if (["viewer.onModelLoaded", "viewer.onModelsLoaded", "viewer.onModelAdded"].includes(event)) {
              const modelle = await ladeModelle(apiRef.current);
              setViewerState(prev => ({
                ...prev, modelle,
                aktivesModellId: modelle.length > 0
                  ? (modelle.find(m => m.id === prev.aktivesModellId) ? prev.aktivesModellId : modelle[0].id)
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

        try {
          const token = await instance.extension.requestPermission("accesstoken");
          if (typeof token === "string" && token.length > 10) {
            setAccessToken(token);
          }
        } catch (e) { console.warn("accessToken:", e); }

        try {
          const proj = await instance.project.getProject() as any;
          const pid: string = proj?.id || proj?.projectId || proj?.projectid || proj?.project_id || "";
          setProjectId(pid);
          console.log("Project ID:", pid);
        } catch {
          try {
            const proj = await (instance.project as any).getCurrentProject() as any;
            setProjectId(proj?.id || proj?.projectId || "");
          } catch {}
        }

        try {
          const modelle = await ladeModelle(instance);
          setIsViewerContext(true);
          setViewerState(prev => ({
            ...prev, modelle,
            aktivesModellId: modelle.length > 0 ? modelle[0].id : "",
          }));
        } catch {
          setIsViewerContext(false);
        }

        setApi(instance);
        setConnected(true);
      } catch (err) {
        console.error("connect:", err);
        setConnected(false);
      }
    }
    connect();
  }, []);

  return { api, connected, isViewerContext, accessToken, projectId, viewerState, setViewerState };
}