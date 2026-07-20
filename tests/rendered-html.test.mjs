import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Circuit Matgo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Circuit Matgo \| 디지털 맞고<\/title>/i);
  assert.match(html, /DEALING CIRCUIT/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete game engine and 48 card assets", async () => {
  const [page, game, css, cards] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readdir(new URL("../public/cards/", import.meta.url)),
  ]);

  assert.equal(cards.filter((name) => name.endsWith(".webp")).length, 48);
  assert.match(page, /chooseGo/);
  assert.match(page, /chooseStop/);
  assert.match(game, /고도리/);
  assert.match(game, /광박/);
  assert.match(css, /@media \(max-width: 460px\)/);
});
