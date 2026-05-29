export type TaskTyp = "neubau" | "bestand" | "abbruch";

export interface Task {
  id: string;
  name: string;
  start: string;
  end: string;
  typ: TaskTyp;
  objektGuids: string[];
  manuellefarbe?: { r: number; g: number; b: number; a: number };
}

export interface Modell {
  id: string;
  name: string;
}

export interface AppState {
  tasks: Task[];
  aktivesModellId: string;
}