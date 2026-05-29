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
          (event: string, args: any) => {
            switch (event) {
              case "extension.command":
                console.log("Command:", args);
                break;
              case "extension.accessToken":
                console.log("Token:", args);
                break;
              case "extension.userSettingsChanged":
                console.log("Settings changed");
                break;
              default:
                console.log("Event:", event, args);
            }
          },
          30000
        );

        await instance.ui.setMenu({
          title: "4D Bauablauf",
          icon: "https://project-fb9pr-red.vercel.app/icons.svg",
          command: "open",
          subMenus: [
            {
              title: "Simulation starten",
              icon: "https://project-fb9pr-red.vercel.app/icons.svg",
              command: "simulation"
            }
          ]
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