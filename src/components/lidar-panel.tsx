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

type LidarPanelProps = {
  receivedLabel: string;
  received: boolean;
  roiAlarms: RoiAlarm[];
  roiMarkers: RoiMarker[];
  topic: string;
};

export function LidarPanel({
  receivedLabel,
  received,
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
      <RoiScene markers={roiMarkers} />
      <div className="roi-list">
        {roiAlarms.map((roi) => (
          <RoiCard key={roi.name} roi={roi} />
        ))}
      </div>
    </section>
  );
}

function RoiScene({ markers }: { markers: RoiMarker[] }) {
  const camera = cameraForMarkers(markers);

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
        <gridHelper args={[8, 8, '#345047', '#1d2a26']} />
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
      {markers.length === 0 ? (
        <p className="empty">ROI 영역 수신 대기</p>
      ) : null}
    </div>
  );
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

function cameraForMarkers(markers: RoiMarker[]) {
  if (markers.length === 0) {
    return { height: 10, x: 0, z: 0, zoom: 45 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const marker of markers) {
    const { position } = marker.pose;
    const { scale } = marker;
    minX = Math.min(minX, position.x - scale.x / 2);
    maxX = Math.max(maxX, position.x + scale.x / 2);
    minZ = Math.min(minZ, position.y - scale.y / 2);
    maxZ = Math.max(maxZ, position.y + scale.y / 2);
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
