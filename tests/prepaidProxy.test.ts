import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Static deployment regression only; not an nginx -t or live proxy test.
describe("Prepaid upload proxy boundary", () => {
  const conf = readFileSync(
    resolve(process.cwd(), "nginx/default.conf"),
    "utf8",
  );
  it("scopes the larger streamed body limit to Prepaid", () => {
    const block = conf.match(
      /location \^~ \/api\/workflows\/prepaid\/ \{([^}]+)\}/,
    )![1];
    expect(block).toContain("client_max_body_size 101m;");
    expect(block).toContain("proxy_request_buffering off;");
    expect(block).toContain("proxy_send_timeout 300s;");
    expect(block).toContain("proxy_read_timeout 300s;");
    expect(block).toContain("proxy_http_version 1.1;");
    expect(block).toContain(
      "proxy_set_header Authorization $http_authorization;",
    );
  });
  it("retains the existing default and general API forwarding", () => {
    expect(conf.split("client_max_body_size 201m;")).toHaveLength(2);
    const general = conf.match(/location \^~ \/api\/ \{([^}]+)\}/)![1];
    expect(general).not.toContain("client_max_body_size");
    expect(general).toContain("proxy_pass $api_upstream;");
  });
});
