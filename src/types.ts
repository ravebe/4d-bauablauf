// Skizzentool — Typen

export interface TcModel {
  modelId: string;
  name: string;
  fileName?: string;
}

// TC SectionPlane — Position in MILLIMETERN
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

// TC SectionBox — Position + Size in MILLIMETERN, Rotation als Quaternion
export interface TcSectionBox {
  positionX: number;
  positionY: number;
  positionZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  excludedVersionIds?: string[];
}

// TC Vector3 — in METERN
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
  pitch?: number;
  yaw?: number;
  fieldOfView?: number;
  orthoSize?: number;
  projectionType?: TcProjectionType;
}
