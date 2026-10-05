"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Unbundled CommonJS Node worker entry. */

// Tesseract 7 sends a boolean `lstmOnly` to its Node adapter, whose getCore
// still expects numeric OEM. Normalize at that boundary so the traced LSTM
// runtime is selected consistently on both local and serverless Node.
const { parentPort } = require("node:worker_threads");
const worker = require("tesseract.js/src/worker-script");
const getCore = require("tesseract.js/src/worker-script/node/getCore");
const OEM = require("tesseract.js/src/constants/OEM");
worker.setAdapter({
  getCore: (mode, path, response) => getCore(typeof mode === "boolean" ? (mode ? OEM.LSTM_ONLY : OEM.TESSERACT_ONLY) : mode, path, response),
  gunzip: require("tesseract.js/src/worker-script/node/gunzip"),
  fetch: globalThis.fetch,
  ...require("tesseract.js/src/worker-script/node/cache"),
});
parentPort.on("message", packet => worker.dispatchHandlers(packet, result => parentPort.postMessage(result)));
