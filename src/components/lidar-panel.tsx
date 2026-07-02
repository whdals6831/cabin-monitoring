export type RoiAlarm = {
  name: string;
  alarm: boolean;
  point_count: number;
  threshold: number;
};

export type RoiAlarmArray = {
  alarms: RoiAlarm[];
};

type LidarPanelProps = {
  receivedLabel: string;
  received: boolean;
  roiAlarms: RoiAlarm[];
  topic: string;
};

export function LidarPanel({
  receivedLabel,
  received,
  roiAlarms,
  topic,
}: LidarPanelProps) {
  const activeRoiCount = roiAlarms.filter((roi) => roi.alarm).length;

  return (
    <section className="panel lidar-panel" aria-label="라이다 ROI 상태">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">LiDAR ROI</p>
          <h2>{topic}</h2>
        </div>
        <StatusPill active={received} label={receivedLabel} />
      </div>
      <div className="roi-summary">
        <strong>{activeRoiCount}</strong>
        <span>active zones</span>
      </div>
      <div className="roi-list">
        {roiAlarms.length > 0 ? (
          roiAlarms.map((roi) => <RoiCard key={roi.name} roi={roi} />)
        ) : (
          <p className="empty">ROI 상태 수신 대기</p>
        )}
      </div>
    </section>
  );
}

function RoiCard({ roi }: { roi: RoiAlarm }) {
  const percent = Math.min(
    100,
    Math.round((roi.point_count / Math.max(roi.threshold, 1)) * 100),
  );

  return (
    <article className={`roi-card ${roi.alarm ? 'roi-card-alarm' : ''}`}>
      <div>
        <h3>{roi.name}</h3>
        <p>{roi.alarm ? '감지' : '정상'}</p>
      </div>
      <strong>
        {roi.point_count}
        <span> / {roi.threshold}</span>
      </strong>
      <div className="roi-meter" aria-label={`임계값 대비 ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`status-pill ${active ? 'status-live' : ''}`}>
      {label}
    </span>
  );
}
