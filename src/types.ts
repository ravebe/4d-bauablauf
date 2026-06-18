// 4D Bauablaufsimulation BETA — Schnitt-Tool
// Typen rund um TC Model, Section Plane, Camera

export interface TcModel {
  modelId: string;
  name: string;
  fileName?: string;
}

// TC SectionPlane — Position in MILLIMETERN, direction als Einheitsvektor
export interface TcSectionPlane {
  id?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  directionX?: number;
  directionY?: number;
  directionZ?: number;
  controlsVisible?: boolean;
  viewId?: string;
}

// TC Vector3 — in METERN (Achtung: andere Einheit als SectionPlane!)
export interface TcVector3 {
  x: number;
  y: number;
  z: number;
}

export type TcProjectionType = "perspective" | "orthographic";

// TC Camera — Position/lookAt in METERN
export interface TcCamera {
  position?: TcVector3;
  lookAt?: TcVector3;
  upDirection?: TcVector3;
  pitch?: number;        // Radiant
  yaw?: number;          // Radiant
  fieldOfView?: number;  // Grad, Standard 60
  orthoSize?: number;    // View-Skalierung bei orthographischer Projektion
  projectionType?: TcProjectionType;
}

// Eigene Schnitt-Konfiguration (lokal verwaltet, noch nicht persistiert)
export type Ausrichtung = "horizontal" | "vertikal";

export interface SchnittKonfig {
  ausrichtung: Ausrichtung;
  ebene: TcSectionPlane;
  modelId: string;
}
