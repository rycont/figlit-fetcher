#!/usr/bin/env node

const { Api } = require("figma-api");
const axios = require("axios");
const { readFile, writeFile, mkdir } = require("fs/promises");
const readline = require("readline");

const figma = new Api({
  personalAccessToken: "298625-64628da4-d51d-452d-882c-aeb7cdabe4e3",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (message) =>
  new Promise((resolve) => {
    rl.question(message, (answer) => resolve(answer));
  });

const parseName = (name) => {
  const [exposer, configRaw] = name.split("?");
  if (!configRaw) return {};
  return Object.fromEntries(
    configRaw
      .split("&")
      .map((e) => e.split("="))
      .map(([key, value]) => [key, value || true])
  );
};

const getImageNodes = (node, prevIds = []) => {
  if (node.type === "VECTOR" || parseName(node.name)["@svg"])
    return [...prevIds, node.id];

  const elements =
    node.children?.map((element) => getImageNodes(element, prevIds)) || [];
  return elements.flat();
};

(async () => {
  const ora = (await import("ora")).default;
  console.log("\n\n🚀 Welcome to Figlit!\n");

  const URI = (await ask("Tell me your Figma Document URI: ")).split("/")[4];
  const loadOra = ora("Loading your document...").start();

  const figmaDocumnet = await figma.getFile(URI, {
    geometry: "paths",
  });

  loadOra.succeed("👍 Document loaded!\n");

  const documentName = await ask(
    `What is your project name? (default: ${figmaDocumnet.name}): `
  );
  const WORKDIR = `${process.cwd()}/${documentName}/`;

  await mkdir(WORKDIR);

  console.log(`📂 Working directory: ${WORKDIR}\n`);

  await writeFile(
    WORKDIR + "figlit.data.json",
    JSON.stringify({
      document: figmaDocumnet,
      id: URI,
    })
  );

  const imageNodes = getImageNodes(figmaDocumnet.document);

  const downloadOra = ora("Downloading your images...").start();

  let downloaded = 0;
  await Promise.all(
    imageNodes.map(async (current, index) => {
      const imageUrl = (
        await figma.getImage(URI, {
          ids: current,
          format: "svg",
          scale: 1,
        })
      ).images[current];
      if (!imageUrl) return;
      const content = (await axios(imageUrl)).data;
      await writeFile(WORKDIR + encodeURIComponent(current) + ".svg", content);

      downloadOra.text = `Downloading your images... ${++downloaded}/${imageNodes.length}`;
    })
  );
  downloadOra.succeed("🎉 All images downloaded!");

  
  process.exit()
})();
