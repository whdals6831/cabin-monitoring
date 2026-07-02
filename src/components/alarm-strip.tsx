import type { RoiAlarm } from '@/components/lidar-panel';

export type MonitoringAlarm = {
  alarm: boolean;
  level: 'green' | 'yellow' | 'red' | string;
  status: string;
  age_seconds: number;
  active_rois: RoiAlarm[];
  matched_detections: Array<{
    label: string;
    score: number;
  }>;
};

type AlarmStripProps = {
  alarm: MonitoringAlarm | null;
  receivedLabel: string;
  topic: string;
};

export function AlarmStrip({ alarm, receivedLabel, topic }: AlarmStripProps) {
  return (
    <section className={`alarm-strip alarm-${alarm?.level ?? 'unknown'}`}>
      <div>
        <p className="panel-kicker">Alarm</p>
        <h2>{alarmTitle(alarm)}</h2>
      </div>
      <div className="alarm-detail">
        <span>{topic}</span>
        <span>{alarmDescription(alarm)}</span>
        <span>{receivedLabel}</span>
      </div>
    </section>
  );
}

function alarmTitle(alarm: MonitoringAlarm | null) {
  if (!alarm) {
    return '알람 수신 대기';
  }
  if (alarm.level === 'red') {
    return '위험 감지';
  }
  if (alarm.level === 'yellow') {
    return '주의 감지';
  }
  return '정상 감시 중';
}

function alarmDescription(alarm: MonitoringAlarm | null) {
  if (!alarm) {
    return '최종 알람 이벤트가 아직 도착하지 않았습니다.';
  }

  const labels = alarm.matched_detections
    .map((detection) => detection.label)
    .join(', ');
  const rois = alarm.active_rois.map((roi) => roi.name).join(', ');
  return [
    alarm.status,
    rois || 'active ROI 없음',
    labels || 'matching detection 없음',
  ].join(' · ');
}
