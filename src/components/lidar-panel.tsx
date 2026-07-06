import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';

import {
  rosSizeToSceneSize,
  rosToScenePoint,
  type RosVector3,
} from '@/components/lidar-coordinates';

export type RoiAlarm = {
  name: string;
  alarm: boolean;
  point_count: number;
  threshold: number;
};

export type RoiAlarmArray = {
  alarms: RoiAlarm[];
};

export type RoiMarker = {
  id: number;
  pose: {
    position: RosVector3;
  };
  scale: RosVector3;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
};

export type RoiMarkerArray = {
  markers: RoiMarker[];
};

export type LidarPoint = RosVector3;

const LIDAR_VIEW = {
  range: 50,
  fov: (Math.PI * 140) / 180,
  initialRange: 18,
};

type LidarPanelProps = {
  receivedLabel: string;
  received: boolean;
  pointCloudLabel: string;
  points: LidarPoint[];
  roiAlarms: RoiAlarm[];
  roiMarkers: RoiMarker[];
  topic: string;
};

export function LidarPanel({
  receivedLabel,
  received,
  pointCloudLabel,
  points,
  roiAlarms,
  roiMarkers,
  topic,
}: LidarPanelProps) {
  return (
    <section className="panel lidar-panel" aria-label="라이다 ROI 상태">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">LiDAR ROI</p>
          <h2>{topic}</h2>
        </div>
        <StatusPill active={received} label={receivedLabel} />
      </div>
      <RoiScene
        markers={roiMarkers}
        pointCloudLabel={pointCloudLabel}
        points={points}
      />
      <div className="roi-list">
        {roiAlarms.map((roi) => (
          <RoiCard key={roi.name} roi={roi} />
        ))}
      </div>
    </section>
  );
}

function RoiScene({
  markers,
  pointCloudLabel,
  points,
}: {
  markers: RoiMarker[];
  pointCloudLabel: string;
  points: LidarPoint[];
}) {
  const camera = cameraForScene(markers, points);

  return (
    <div className="roi-scene">
      <Canvas
        orthographic
        camera={{
          position: [0, camera.height, 0],
          rotation: [-Math.PI / 2, 0, 0],
          up: [0, 0, 1],
          zoom: camera.zoom,
        }}
      >
        <FovGuide />
        <LidarOrigin />
        <PointCloud points={points} />
        <OrbitControls makeDefault enableDamping={false} target={[0, 0, 0]} />
        <GizmoHelper alignment="bottom-right" margin={[54, 54]}>
          <GizmoViewport
            axisColors={['#ff5c5c', '#23d77a', '#5c8dff']}
            labels={['Y', 'Z', 'X']}
            labelColor="#f7fffb"
          />
        </GizmoHelper>
        {markers.map((marker) => (
          <RoiBox key={marker.id} marker={marker} />
        ))}
      </Canvas>
      <span className="scene-feed">
        PCD {pointCloudLabel} · {points.length} pts
      </span>
      {markers.length === 0 && points.length === 0 ? (
        <p className="empty">ROI/PCD 수신 대기</p>
      ) : null}
    </div>
  );
}

function FovGuide() {
  const geometries = useMemo(() => {
    const edge = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, 0),
      guidePoint(-LIDAR_VIEW.fov / 2, LIDAR_VIEW.range),
      new THREE.Vector3(0, 0.01, 0),
      guidePoint(LIDAR_VIEW.fov / 2, LIDAR_VIEW.range),
    ]);
    const rings = [10, 20, 30, 40, 50].map((range) =>
      new THREE.BufferGeometry().setFromPoints(arcPoints(range)),
    );
    return { edge, rings };
  }, []);

  return (
    <group>
      <lineSegments geometry={geometries.edge}>
        <lineBasicMaterial color="#4fa087" transparent opacity={0.62} />
      </lineSegments>
      {geometries.rings.map((geometry, index) => (
        <group key={index}>
          <lineSegments geometry={geometry}>
            <lineBasicMaterial color="#2f6f62" transparent opacity={0.55} />
          </lineSegments>
          <Html position={guidePoint(0, (index + 1) * 10)} center>
            <span className="range-label">{(index + 1) * 10}m</span>
          </Html>
        </group>
      ))}
    </group>
  );
}

function LidarOrigin() {
  const heading = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.12, 0),
        new THREE.Vector3(0, 0.12, 0.55),
      ]),
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.16, 24]} />
        <meshBasicMaterial color="#f7fffb" />
      </mesh>
      <lineSegments geometry={heading}>
        <lineBasicMaterial color="#f7fffb" />
      </lineSegments>
    </group>
  );
}

function PointCloud({ points }: { points: LidarPoint[] }) {
  const geometry = useMemo(() => {
    const maxPoints = 12000;
    // ponytail: canvas cap only; raise it when profiling says the browser can afford more.
    const step = Math.max(1, Math.ceil(points.length / maxPoints));
    const positions = new Float32Array(Math.ceil(points.length / step) * 3);
    let offset = 0;

    for (let i = 0; i < points.length; i += step) {
      const point = points[i];
      const [sceneX, sceneY, sceneZ] = rosToScenePoint(point);
      positions[offset] = sceneX;
      positions[offset + 1] = sceneY;
      positions[offset + 2] = sceneZ;
      offset += 3;
    }

    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
  }, [points]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#f2d06b"
        depthTest={false}
        size={2}
        sizeAttenuation={false}
      />
    </points>
  );
}

function guidePoint(angle: number, range: number) {
  return new THREE.Vector3(
    Math.sin(angle) * range,
    0.01,
    Math.cos(angle) * range,
  );
}

function arcPoints(range: number) {
  const points: THREE.Vector3[] = [];
  const segments = 40;
  let previous = guidePoint(-LIDAR_VIEW.fov / 2, range);
  for (let i = 1; i <= segments; i += 1) {
    const angle = -LIDAR_VIEW.fov / 2 + (LIDAR_VIEW.fov * i) / segments;
    const current = guidePoint(angle, range);
    points.push(previous, current);
    previous = current;
  }
  return points;
}

function RoiBox({ marker }: { marker: RoiMarker }) {
  const { position } = marker.pose;
  const { scale } = marker;
  const { x: scaleX, y: scaleY, z: scaleZ } = scale;
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(
      ...rosSizeToSceneSize({ x: scaleX, y: scaleY, z: scaleZ }),
    );
    return new THREE.EdgesGeometry(box);
  }, [scaleX, scaleY, scaleZ]);
  const color = useMemo(
    () => new THREE.Color(marker.color.r, marker.color.g, marker.color.b),
    [marker.color.b, marker.color.g, marker.color.r],
  );

  return (
    <group position={rosToScenePoint(position)}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} />
      </lineSegments>
      <Html position={[0, scaleZ / 2 + 0.12, 0]} center>
        <span className="roi-measure-label">
          x {formatMeter(position.x - scaleX / 2)}-
          {formatMeter(position.x + scaleX / 2)}m · 폭 {formatMeter(scaleY)}m
        </span>
      </Html>
    </group>
  );
}

function cameraForScene(markers: RoiMarker[], points: LidarPoint[]) {
  const range =
    markers.length === 0 && points.length === 0 ? LIDAR_VIEW.initialRange : 1;
  let minX = -Math.sin(LIDAR_VIEW.fov / 2) * range;
  let maxX = Math.sin(LIDAR_VIEW.fov / 2) * range;
  let minZ = 0;
  let maxZ = range;

  for (const marker of markers) {
    const { position } = marker.pose;
    const { scale } = marker;
    minX = Math.min(minX, position.y - scale.y / 2);
    maxX = Math.max(maxX, position.y + scale.y / 2);
    minZ = Math.min(minZ, position.x - scale.x / 2);
    maxZ = Math.max(maxZ, position.x + scale.x / 2);
  }

  const width = Math.max(maxX - minX, maxZ - minZ, 1);

  return {
    height: 10,
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    zoom: 110 / width,
  };
}

function formatMeter(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function RoiCard({ roi }: { roi: RoiAlarm }) {
  const percent = Math.min(
    100,
    Math.round((roi.point_count / Math.max(roi.threshold, 1)) * 100),
  );

  return (
    <article className={'roi-card ' + (roi.alarm ? 'roi-card-alarm' : '')}>
      <div>
        <h3>{roi.name}</h3>
        <p>{roi.alarm ? '감지' : '정상'}</p>
      </div>
      <strong>
        {roi.point_count}
        <span> / {roi.threshold}</span>
      </strong>
      <div className="roi-meter" aria-label={'임계값 대비 ' + percent + '%'}>
        <span style={{ width: percent + '%' }} />
      </div>
    </article>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={'status-pill ' + (active ? 'status-live' : '')}>
      {label}
    </span>
  );
}
