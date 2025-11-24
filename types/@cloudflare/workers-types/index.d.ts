interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run<T = any>(): Promise<T>;
  raw<T = any>(): Promise<T[]>;
  all<T = any>(): Promise<{ results: T[]; success: boolean; }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<T[]>;
  dump(): Promise<ArrayBuffer>;
  withSession(name?: string): D1Database;
  getBookmark?(): string | null;
}

interface R2Bucket {
  get(key: string): Promise<any>;
  put(key: string, value: any, options?: any): Promise<any>;
  delete(key: string | string[]): Promise<void>;
}

type Queue<T = any> = {
  send(message: T): Promise<void>;
};

type DurableObjectId = any;

type DurableObjectStub = {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
};

type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
};

type DurableObjectState = {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    list<T>(options?: any): Promise<Map<string, T>>;
  };
  id: DurableObjectId;
  waitUntil(promise: Promise<any>): void;
  getWebSockets(): WebSocket[];
  acceptWebSocket(webSocket: WebSocket): void;
};

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface IncomingRequestCf extends Request {}

interface WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

declare const WebSocketPair: {
  new (): WebSocketPair;
};

interface Cache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

declare const caches: {
  default: Cache;
};

interface DurableObject {
  fetch(request: Request): Promise<Response> | Response;
  alarm?(): Promise<void> | void;
  webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): Promise<void> | void;
  webSocketClose?(ws: WebSocket): Promise<void> | void;
}

type Message<T = unknown> = { body: T };
type MessageBatch<T = unknown> = { messages: Message<T>[] };

interface ScheduledEvent {
  scheduledTime: number;
}
