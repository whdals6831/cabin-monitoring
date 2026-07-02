import { useEffect, useRef, useState } from 'react';
import { parse } from '@foxglove/rosmsg';
import { MessageReader } from '@foxglove/rosmsg2-serialization';
import { FoxgloveClient } from '@foxglove/ws-protocol';
import type {
  IWebSocket,
  MessageData,
  SubscriptionId,
} from '@foxglove/ws-protocol';

const BRIDGE_URL = `ws://${window.location.hostname}:8765`;
const BRIDGE_SUBPROTOCOL = 'foxglove.sdk.v1';
const TOPICS = {
  camera: '/detections/image',
  lidar: '/lidar/roi_alarm',
  alarms: '/monitoring/alarms',
} as const;

type ConnectionState = 'connecting' | 'connected' | 'closed' | 'error';

type RosImage = {
  width: number;
  height: number;
  encoding: string;
  step: number;
  data: Uint8Array | number[];
};

type RoiAlarm = {
  name: string;
  alarm: boolean;
  point_count: number;
  threshold: number;
};

type RoiAlarmArray = {
  alarms: RoiAlarm[];
};

type MonitoringAlarm = {
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

type TopicState<T> = {
  data: T | null;
  receivedAt: number | null;
};

type Subscription = {
  topic: string;
  reader: MessageReader;
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const subscriptionsRef = useRef(new Map<SubscriptionId, Subscription>());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [imageReceivedAt, setImageReceivedAt] = useState<number | null>(null);
  const [lidar, setLidar] = useState<TopicState<RoiAlarmArray>>({
    data: null,
    receivedAt: null,
  });
  const [alarm, setAlarm] = useState<TopicState<MonitoringAlarm>>({
    data: null,
    receivedAt: null,
  });

  useEffect(() => {
    const ws = new WebSocket(BRIDGE_URL, [BRIDGE_SUBPROTOCOL]);
    const client = new FoxgloveClient({ ws: ws as unknown as IWebSocket });
    const subscriptions = subscriptionsRef.current;

    client.on('open', () => setConnection('connected'));
    client.on('close', () => setConnection('closed'));
    client.on('error', () => setConnection('error'));
    client.on('advertise', (advertisedChannels) => {
      for (const channel of advertisedChannels) {
        if (!isRequiredTopic(channel.topic) || channel.encoding !== 'cdr') {
          continue;
        }

        const subscriptionId = client.subscribe(channel.id);
        subscriptions.set(subscriptionId, {
          topic: channel.topic,
          reader: new MessageReader(parse(channel.schema, { ros2: true })),
        });
      }
    });
    client.on('message', (message) => {
      const subscription = subscriptions.get(message.subscriptionId);
      if (!subscription) {
        return;
      }
      handleMessage(subscription, message, canvasRef.current, {
        setImageReceivedAt,
        setLidar,
        setAlarm,
      });
    });

    return () => {
      client.close();
      subscriptions.clear();
    };
  }, []);

  const activeAlarm = alarm.data;
  const roiAlarms = lidar.data?.alarms ?? [];
  const activeRoiCount = roiAlarms.filter((roi) => roi.alarm).length;

  return (
    <main className="monitor">
      <header className="topbar">
        <div>
          <p className="eyebrow">Crane cabin monitoring</p>
          <h1>Cabin Watch</h1>
        </div>
        <div className={`bridge bridge-${connection}`}>
          <span />
          {connectionLabel(connection)} · {BRIDGE_URL}
        </div>
      </header>

      <section className="workspace" aria-label="실시간 모니터링">
        <section className="panel camera-panel" aria-label="카메라 화면">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Camera</p>
              <h2>{TOPICS.camera}</h2>
            </div>
            <StatusPill
              active={imageReceivedAt != null}
              label={timeLabel(imageReceivedAt)}
            />
          </div>
          <div className="camera-frame">
            <canvas ref={canvasRef} aria-label="객체 검출 카메라 영상" />
            {imageReceivedAt == null ? (
              <p className="empty">영상 수신 대기</p>
            ) : null}
          </div>
        </section>

        <section className="panel lidar-panel" aria-label="라이다 ROI 상태">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">LiDAR ROI</p>
              <h2>{TOPICS.lidar}</h2>
            </div>
            <StatusPill
              active={lidar.receivedAt != null}
              label={timeLabel(lidar.receivedAt)}
            />
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
      </section>

      <section
        className={`alarm-strip alarm-${activeAlarm?.level ?? 'unknown'}`}
      >
        <div>
          <p className="panel-kicker">Alarm</p>
          <h2>{alarmTitle(activeAlarm)}</h2>
        </div>
        <div className="alarm-detail">
          <span>{TOPICS.alarms}</span>
          <span>{alarmDescription(activeAlarm)}</span>
          <span>{timeLabel(alarm.receivedAt)}</span>
        </div>
      </section>
    </main>
  );
}

function handleMessage(
  subscription: Subscription,
  message: MessageData,
  canvas: HTMLCanvasElement | null,
  setters: {
    setImageReceivedAt: (time: number) => void;
    setLidar: (state: TopicState<RoiAlarmArray>) => void;
    setAlarm: (state: TopicState<MonitoringAlarm>) => void;
  },
) {
  const receivedAt = timestampToMs(message.timestamp);
  const decoded = subscription.reader.readMessage(message.data);

  if (subscription.topic === TOPICS.camera) {
    drawImage(canvas, decoded as RosImage);
    setters.setImageReceivedAt(receivedAt);
    return;
  }

  if (subscription.topic === TOPICS.lidar) {
    setters.setLidar({ data: decoded as RoiAlarmArray, receivedAt });
    return;
  }

  if (subscription.topic === TOPICS.alarms) {
    const text = (decoded as { data?: string }).data;
    if (text) {
      setters.setAlarm({
        data: JSON.parse(text) as MonitoringAlarm,
        receivedAt,
      });
    }
  }
}

function drawImage(canvas: HTMLCanvasElement | null, image: RosImage) {
  if (!canvas || image.width <= 0 || image.height <= 0) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const source =
    image.data instanceof Uint8Array ? image.data : Uint8Array.from(image.data);
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  const encoding = image.encoding.toLowerCase();
  const channels =
    encoding.includes('rgba') || encoding.includes('bgra')
      ? 4
      : encoding.includes('mono')
        ? 1
        : 3;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceIndex = y * image.step + x * channels;
      const targetIndex = (y * image.width + x) * 4;
      const first = source[sourceIndex] ?? 0;
      const second = source[sourceIndex + 1] ?? first;
      const third = source[sourceIndex + 2] ?? first;
      const alpha = channels === 4 ? (source[sourceIndex + 3] ?? 255) : 255;

      rgba[targetIndex] = encoding.includes('bgr') ? third : first;
      rgba[targetIndex + 1] = second;
      rgba[targetIndex + 2] = encoding.includes('bgr') ? first : third;
      rgba[targetIndex + 3] = alpha;
    }
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
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

function isRequiredTopic(
  topic: string,
): topic is (typeof TOPICS)[keyof typeof TOPICS] {
  return Object.values(TOPICS).includes(
    topic as (typeof TOPICS)[keyof typeof TOPICS],
  );
}

function timestampToMs(timestamp: bigint) {
  return Number(timestamp / 1_000_000n);
}

function timeLabel(time: number | null) {
  return time == null
    ? '대기중'
    : new Date(time).toLocaleTimeString('ko-KR', { hour12: false });
}

function connectionLabel(connection: ConnectionState) {
  return {
    connecting: '연결 중',
    connected: '연결됨',
    closed: '연결 종료',
    error: '연결 오류',
  }[connection];
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

export default App;
