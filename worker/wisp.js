/**
 * Wisp v1 protocol server — Cloudflare Workers native.
 * Shuttles TCP streams (via cloudflare:sockets) over a WebSocket,
 * exactly what epoxy-transport needs as its backend tunnel.
 *
 * Frame layout: [type u8][streamID u32 LE][payload...]
 *  CONNECT(1): payload = [streamType u8][port u16 LE][hostname utf8]
 *  DATA(2):     payload = raw bytes for the stream
 *  CONTINUE(3): payload = [bufferSize u32 LE]
 *  CLOSE(4):    payload = [reason u8]
 */
import { connect } from "cloudflare:sockets";

const T_CONNECT = 1;
const T_DATA = 2;
const T_CONTINUE = 3;
const T_CLOSE = 4;

const STREAM_TCP = 1;

// wisp close reason codes (from the protocol spec)
const R_NORMAL = 0x01; // server closed the stream
const R_ERROR = 0x41; // generic error connecting

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function frame(type, streamID, payload) {
  const p = payload ? new Uint8Array(payload) : new Uint8Array(0);
  const buf = new Uint8Array(5 + p.byteLength);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, type);
  dv.setUint32(1, streamID, true);
  buf.set(p, 5);
  return buf;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // wisp tunnel endpoint
    if (
      request.headers.get("Upgrade") === "websocket" &&
      url.pathname.startsWith("/wisp/")
    ) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      handleWisp(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // everything else falls back to static assets (404 page)
    return env.ASSETS.fetch(request);
  },
};

function handleWisp(ws) {
  const streams = new Map();

  // initial flow-control frame on stream 0, as the wisp protocol requires
  ws.send(frame(T_CONTINUE, 0, u32le(127)));

  const cleanup = (id) => {
    const s = streams.get(id);
    if (!s) return;
    streams.delete(id);
    try { s.reader.cancel(); } catch {}
    try { s.writer.close(); } catch {}
    try { s.socket.close(); } catch {}
  };

  ws.addEventListener("message", async (ev) => {
    let raw = ev.data;
    if (typeof raw === "string") return; // wisp is binary only
    if (raw instanceof ArrayBuffer) raw = new Uint8Array(raw);
    else if (raw.byteLength !== undefined && !(raw instanceof Uint8Array)) {
      raw = new Uint8Array(raw); // Blob-ish fallback
    }
    if (raw.byteLength < 5) return;

    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const type = dv.getUint8(0);
    const streamID = dv.getUint32(1, true);
    const payload = raw.subarray(5);

    if (type === T_CONNECT) {
      const streamType = dv.getUint8(5);
      const port = dv.getUint16(6, true);
      const hostname = new TextDecoder().decode(raw.subarray(8));

      // only TCP streams supported on Workers
      if (streamType !== STREAM_TCP) {
        ws.send(frame(T_CLOSE, streamID, new Uint8Array([0x02]))); // unsupported stream type
        return;
      }

      try {
        const socket = connect({ hostname, port });
        await socket.opened;
        const writer = socket.writable.getWriter();
        const reader = socket.readable.getReader();
        streams.set(streamID, { socket, writer, reader });

        // tell the client we're ready + its usable buffer size
        ws.send(frame(T_CONTINUE, streamID, u32le(65535)));

        // pump: TCP -> websocket
        (async () => {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!streams.has(streamID)) break;
              ws.send(frame(T_DATA, streamID, value));
            }
            if (streams.has(streamID)) {
              ws.send(frame(T_CLOSE, streamID, new Uint8Array([R_NORMAL])));
            }
          } catch {
            try {
              ws.send(frame(T_CLOSE, streamID, new Uint8Array([R_ERROR])));
            } catch {}
          }
          cleanup(streamID);
        })();
      } catch (e) {
        try { console.log("WISP CONNECT failed:", e && e.message); } catch {}
        // DNS failure, refused connection, blocked port, …
        try {
          ws.send(frame(T_CLOSE, streamID, new Uint8Array([R_ERROR])));
        } catch {}
        cleanup(streamID);
      }
      return;
    }

    if (type === T_DATA) {
      const s = streams.get(streamID);
      if (!s) return;
      try {
        await s.writer.write(payload);
      } catch {
        ws.send(frame(T_CLOSE, streamID, new Uint8Array([R_ERROR])));
        cleanup(streamID);
      }
      return;
    }

    if (type === T_CLOSE) {
      cleanup(streamID);
      return;
    }

    // CONTINUE from client: we don't throttle, nothing to do
  });

  ws.addEventListener("close", () => {
    for (const id of streams.keys()) cleanup(id);
  });
  ws.addEventListener("error", () => {
    for (const id of streams.keys()) cleanup(id);
  });
}
