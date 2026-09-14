var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/wisp.js
import { connect } from "cloudflare:sockets";
var T_CONNECT = 1;
var T_DATA = 2;
var T_CONTINUE = 3;
var T_CLOSE = 4;
var STREAM_TCP = 1;
var R_NORMAL = 1;
var R_ERROR = 65;
function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
__name(u32le, "u32le");
function frame(type, streamID, payload) {
  const p = payload ? new Uint8Array(payload) : new Uint8Array(0);
  const buf = new Uint8Array(5 + p.byteLength);
  const dv = new DataView(buf.buffer);
  dv.setUint8(0, type);
  dv.setUint32(1, streamID, true);
  buf.set(p, 5);
  return buf;
}
__name(frame, "frame");
var wisp_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket" && url.pathname.startsWith("/wisp/")) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      handleWisp(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return env.ASSETS.fetch(request);
  }
};
function handleWisp(ws) {
  const streams = /* @__PURE__ */ new Map();
  ws.send(frame(T_CONTINUE, 0, u32le(127)));
  const cleanup = /* @__PURE__ */ __name((id) => {
    const s = streams.get(id);
    if (!s) return;
    streams.delete(id);
    try {
      s.reader.cancel();
    } catch {
    }
    try {
      s.writer.close();
    } catch {
    }
    try {
      s.socket.close();
    } catch {
    }
  }, "cleanup");
  ws.addEventListener("message", async (ev) => {
    let raw = ev.data;
    if (typeof raw === "string") return;
    if (raw instanceof ArrayBuffer) raw = new Uint8Array(raw);
    else if (raw.byteLength !== void 0 && !(raw instanceof Uint8Array)) {
      raw = new Uint8Array(raw);
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
      if (streamType !== STREAM_TCP) {
        ws.send(frame(T_CLOSE, streamID, new Uint8Array([2])));
        return;
      }
      try {
        const socket = connect({ hostname, port });
        await socket.opened;
        const writer = socket.writable.getWriter();
        const reader = socket.readable.getReader();
        streams.set(streamID, { socket, writer, reader });
        ws.send(frame(T_CONTINUE, streamID, u32le(65535)));
        (async () => {
          try {
            for (; ; ) {
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
            } catch {
            }
          }
          cleanup(streamID);
        })();
      } catch (e) {
        try {
          console.log("WISP CONNECT failed:", e && e.message, e && e.stack);
        } catch {
        }
        try {
          ws.send("ERR:" + String(e && e.message));
        } catch {
        }
        try {
          ws.send(frame(T_CLOSE, streamID, new Uint8Array([R_ERROR])));
        } catch {
        }
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
  });
  ws.addEventListener("close", () => {
    for (const id of streams.keys()) cleanup(id);
  });
  ws.addEventListener("error", () => {
    for (const id of streams.keys()) cleanup(id);
  });
}
__name(handleWisp, "handleWisp");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-ZKBM68/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = wisp_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-ZKBM68/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=wisp.js.map
