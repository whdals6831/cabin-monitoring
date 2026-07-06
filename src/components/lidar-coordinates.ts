export type RosVector3 = {
  x: number;
  y: number;
  z: number;
};

export type SceneVector3 = [number, number, number];

export function rosToScenePoint(point: RosVector3): SceneVector3 {
  return [point.y, point.z, point.x];
}

export function rosSizeToSceneSize(size: RosVector3): SceneVector3 {
  return [size.y, size.z, size.x];
}
