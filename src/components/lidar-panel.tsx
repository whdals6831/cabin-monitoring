import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export type RoiAlarm = {
  name: string;
  alarm: boolean;
  point_count: number;
  threshold: number;
};

export type RoiAlarmArray = {
  alarms: RoiAlarm[];
};

type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type RoiMarker = {
  id: number;
  pose: {
    position: Vector3Like;
  };
  scale: Vector3Like;
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

export type LidarPoint = Vector3Like;

const LIDAR_VIEW = {
  range: 6,
  fov: (Math.PI * 2) / 3,
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
          position: [camera.x, camera.height, camera.z],
          rotation: [-Math.PI / 2, 0, 0],
          zoom: camera.zoom,
        }}
      >
        <FovGuide />
        <LidarOrigin />
        <PointCloud points={points} />
        <OrbitControls makeDefault enableDamping={false} />
        <GizmoHelper alignment="bottom-right" margin={[54, 54]}>
          <GizmoViewport
            axisColors={['#ff5c5c', '#23d77a', '#5c8dff']}
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
    const rings = [2, 4, 6].map((range) =>
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
        <lineSegments key={index} geometry={geometry}>
          <lineBasicMaterial color="#2f6f62" transparent opacity={0.55} />
        </lineSegments>
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
      positions[offset] = point.x;
      positions[offset + 1] = point.z;
      positions[offset + 2] = point.y;
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
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(scale.x, scale.z, scale.y);
    return new THREE.EdgesGeometry(box);
  }, [scale.x, scale.y, scale.z]);
  const color = useMemo(
    () => new THREE.Color(marker.color.r, marker.color.g, marker.color.b),
    [marker.color.b, marker.color.g, marker.color.r],
  );

  return (
    <lineSegments
      geometry={geometry}
      position={[position.x, position.z, position.y]}
    >
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

function cameraForScene(markers: RoiMarker[], points: LidarPoint[]) {
  let minX = -Math.sin(LIDAR_VIEW.fov / 2) * LIDAR_VIEW.range;
  let maxX = Math.sin(LIDAR_VIEW.fov / 2) * LIDAR_VIEW.range;
  let minZ = 0;
  let maxZ = LIDAR_VIEW.range;

  for (const marker of markers) {
    const { position } = marker.pose;
    const { scale } = marker;
    minX = Math.min(minX, position.x - scale.x / 2);
    maxX = Math.max(maxX, position.x + scale.x / 2);
    minZ = Math.min(minZ, position.y - scale.y / 2);
    maxZ = Math.max(maxZ, position.y + scale.y / 2);
  }

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.y);
    maxZ = Math.max(maxZ, point.y);
  }

  const width = Math.max(maxX - minX, maxZ - minZ, 1);

  return {
    height: 10,
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    zoom: 110 / width,
  };
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
