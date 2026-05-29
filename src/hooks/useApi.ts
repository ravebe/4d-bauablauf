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
          async (event: string, data: any) => {
            console.log("Trimble Event:", event, data);
          },
          30000
        );

        await instance.ui.setMenu({
          title: "4D Bauablauf",
          icon: "https://project-fb9pr-red.vercel.app/icons.svg",
          command: "open"
        });

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