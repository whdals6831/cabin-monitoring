import { useEffect, useRef, useState } from 'react';
import { parse } from '@foxglove/rosmsg';
import { MessageReader } from '@foxglove/rosmsg2-serialization';
import { FoxgloveClient } from '@foxglove/ws-protocol';
import type {
  IWebSocket,
  MessageData,
  SubscriptionId,
} from '@foxglove/ws-protocol';
import { AlarmStrip } from '@/components/alarm-strip';
import { CameraPanel } from '@/components/camera-panel';
import { LidarPanel } from '@/components/lidar-panel';
import type { MonitoringAlarm } from '@/components/alarm-strip';
import type { RoiAlarmArray } from '@/components/lidar-panel';

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
        <CameraPanel
          canvasRef={canvasRef}
          hasImage={imageReceivedAt != null}
          receivedLabel={timeLabel(imageReceivedAt)}
          topic={TOPICS.camera}
        />
        <LidarPanel
          received={lidar.receivedAt != null}
          receivedLabel={timeLabel(lidar.receivedAt)}
          roiAlarms={roiAlarms}
          topic={TOPICS.lidar}
        />
      </section>

      <AlarmStrip
        alarm={activeAlarm}
        receivedLabel={timeLabel(alarm.receivedAt)}
        topic={TOPICS.alarms}
      />
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

export default App;
