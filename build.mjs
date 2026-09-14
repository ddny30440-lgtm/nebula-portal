/**
 * Assembles the deployable static bundle (dist/) for Cloudflare:
 *  - our frontend (public/)
 *  - ultraviolet runtime (/uv)
 *  - baremux (/baremux)
 *  - epoxy transport (/epoxy)
 *  - custom uv.config.js overriding the shipped one
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// our frontend
cpSync(path.join(__dirname, "public"), dist, { recursive: true });

// ultraviolet runtime -> /uv
cpSync(
  path.join(__dirname, "node_modules", "@titaniumnetwork-dev", "ultraviolet", "dist"),
  path.join(dist, "uv"),
  { recursive: true }
);

// baremux -> /baremux
cpSync(
  path.join(__dirname, "node_modules", "@mercuryworkshop", "bare-mux", "dist"),
  path.join(dist, "baremux"),
  { recursive: true }
);

// epoxy -> /epoxy
cpSync(
  path.join(__dirname, "node_modules", "@mercuryworkshop", "epoxy-transport", "dist"),
  path.join(dist, "epoxy"),
  { recursive: true }
);

// custom uv config (root-relative paths)
writeFileSync(
  path.join(dist, "uv", "uv.config.js"),
  `/*global Ultraviolet*/
self.__uv$config = {
    prefix: '/uv/service/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js',
};
`
);

console.log("dist/ assembled:");
for (const d of ["", "uv", "baremux", "epoxy"]) {
  console.log("  /" + d);
}
