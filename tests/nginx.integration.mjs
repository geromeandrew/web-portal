import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Native syntax/HTTP gate; container-image validation is a separate release gate.
const binary = process.env.NGINX_BINARY;
assert(
  binary,
  "Set NGINX_BINARY to a local Nginx executable; build the frontend first.",
);
const repo = process.cwd();
const slash = (value) => value.replaceAll("\\", "/");
const temporary = await mkdtemp(path.join(tmpdir(), "esatp-nginx-release-"));
await mkdir(path.join(temporary, "logs"));
await mkdir(path.join(temporary, "temp"));
const sourceHeaders = path.join(repo, "nginx/security-headers.conf");
const assets = await readdir(path.join(repo, "dist/assets"));
const script = assets.find((name) => name.endsWith(".js"));
assert(script, "Build the webapp before this check.");
const upstream = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ method: req.method, path: req.url }));
});
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
try {
  for (const variant of ["production", "default"]) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const access = path.join(temporary, `${variant}.access.log`);
    const error = path.join(temporary, `${variant}.error.log`);
    let source = await readFile(
      path.join(repo, `nginx/${variant}.conf`),
      "utf8",
    );
    source = source
      .replaceAll("/etc/nginx/security-headers.conf", slash(sourceHeaders))
      .replaceAll("/usr/share/nginx/html", slash(path.join(repo, "dist")))
      .replaceAll("/dev/stdout", slash(access))
      .replaceAll("/dev/stderr", slash(error))
      .replace("listen 8080;", `listen 127.0.0.1:${port};`)
      .replace("http://web-portal-api:3001", upstreamUrl)
      // Probe the real error_page rules without adding endpoints to shipped configs.
      .replace(
        "  error_page 403",
        "  location = /__security_forbidden_probe { return 403; }\n  location = /__security_failure_probe { return 500; }\n  error_page 403",
      );
    const conf = path.join(temporary, `${variant}.conf`);
    const mime = path.join(path.dirname(binary), "conf/mime.types");
    await writeFile(
      conf,
      `pid ${slash(path.join(temporary, `${variant}.pid`))};\nevents {}\nhttp { include ${slash(mime)};\n${source}\n}`,
    );
    const args = ["-p", slash(temporary) + "/", "-c", slash(conf)];
    const syntax = spawnSync(binary, [...args, "-t"], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(syntax.status, 0, syntax.stderr);
    const child = spawn(binary, args, { windowsHide: true, stdio: "ignore" });
    let startupError;
    child.on("error", (e) => {
      startupError = e;
    });
    try {
      let ready = false;
      for (let i = 0; i < 40; i++) {
        if (startupError) throw startupError;
        try {
          const r = await fetch(`${base}/healthz`);
          await r.text();
          ready = r.ok;
          if (ready) break;
        } catch {}
        await delay(100);
      }
      assert(ready, `${variant} failed startup`);
      async function check(uri, status, method = "GET") {
        const response = await fetch(base + uri, {
          method,
          headers: {
            Referer: "https://referrer.example/private?token=private-referrer",
          },
        });
        const body = await response.text();
        assert.equal(
          response.status,
          status,
          `${variant} ${method} ${uri}: ${body}`,
        );
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
        if (status >= 400) {
          assert(!body.includes(String(status)));
          assert(!body.toLowerCase().includes("nginx"));
        }
        return { response, body };
      }
      const page = await check(
        "/login/callback?code=private-code&state=private-state",
        200,
      );
      assert(page.body.includes('id="root"'));
      assert(page.response.headers.get("cache-control").includes("no-store"));
      await check("/processing-pipelines?workspace=sample", 200);
      const asset = await check(`/assets/${script}`, 200);
      assert(asset.response.headers.get("cache-control").includes("immutable"));
      await check("/assets/missing.js?token=private-query", 404);
      await check("/security-errors/unavailable.html", 404);
      await check("/__security_forbidden_probe", 403);
      await check("/__security_failure_probe", 500);
      await check("/healthz", 200, "HEAD");
      await check("/", 405, "PROPFIND");
      if (variant === "production") await check("/", 405, "POST");
      else {
        const proxy = await fetch(`${base}/api/security-probe`, {
          method: "POST",
          body: "file-test",
        });
        assert.equal(proxy.status, 200);
        assert.deepEqual(await proxy.json(), {
          method: "POST",
          path: "/api/security-probe",
        });
      }
      await delay(100);
      const logged = await readFile(access, "utf8");
      assert(
        !/private-query|private-code|private-state|private-referrer/.test(
          logged,
        ),
      );
      const entries = logged
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert(entries.some((e) => e.resource === `/assets/${script}`));
      assert(entries.some((e) => e.resource === "/healthz"));
      console.log(
        `PASS ${variant}: syntax, deep links, callback, assets, headers, errors, methods, log privacy${variant === "default" ? ", API proxy" : ""}`,
      );
    } finally {
      spawnSync(binary, [...args, "-s", "quit"], {
        windowsHide: true,
        stdio: "ignore",
      });
    }
  }
} finally {
  await new Promise((resolve) => upstream.close(resolve));
}
console.log(`Validation artifacts: ${temporary}`);
