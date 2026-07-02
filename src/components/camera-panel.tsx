import type { RefObject } from 'react';

type CameraPanelProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  receivedLabel: string;
  hasImage: boolean;
  topic: string;
};

export function CameraPanel({
  canvasRef,
  receivedLabel,
  hasImage,
  topic,
}: CameraPanelProps) {
  return (
    <section className="panel camera-panel" aria-label="카메라 화면">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Camera</p>
          <h2>{topic}</h2>
        </div>
        <StatusPill active={hasImage} label={receivedLabel} />
      </div>
      <div className="camera-frame">
        <canvas ref={canvasRef} aria-label="객체 검출 카메라 영상" />
        {!hasImage ? <p className="empty">영상 수신 대기</p> : null}
      </div>
    </section>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`status-pill ${active ? 'status-live' : ''}`}>
      {label}
    </span>
  );
}
