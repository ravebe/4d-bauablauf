import { useState, useEffect } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";

export function useApi() {
  const [api, setApi] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function connect() {
      try {
        const instance = await WorkspaceAPI.connect(
          window.parent,
          (event: string, data: any) => {
            console.log("Trimble Event:", event, data);
          }
        );
        setApi(instance);
        setConnected(true);
      } catch (err) {
        console.error("Verbindung fehlgeschlagen:", err);
        setConnected(false);
      }
    }
    connect();
  }, []);

  return { api, connected };
}
