#!/usr/bin/env node

const { Api } = require("figma-api");
const axios = require("axios");
const { writeFile, copy, readFile } = require("fs-extra");
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

const CONFIG_FILE_NAME = "figlit.data.json";

const ready = async () => {
  try {
    const config = JSON.parse(
      await readFile(process.cwd() + CONFIG_FILE_NAME, {
        encoding: "utf-8",
      })
    );

    const document = await figma.getFile(config.id, {
      geometry: "paths",
    });

    if (config.id) return {
      workdir: process.cwd(),
      loadMessage: "Updating your assets...",
      document,
      id
    }

    throw ""
  } catch (e) {
    console.log("\n🚀 Welcome to Figlit!\n");

    const id = (await ask("Tell me your Figma Document URI: ")).split("/")[4];

    const document = await figma.getFile(id, {
      geometry: "paths",
    });

    const documentName = await ask(
      `What is your project name? (default: ${document.name}): `
    );
    const workdir = `${process.cwd()}/${documentName}/`;

    await copy(__dirname + "/boilerplate", `${workdir}`);

    return {
      workdir,
      loadMessage: `Loading your Figma document...`,
      document,
      id
    }
  }
};

(async () => {
  const ora = (await import("ora")).default;

  const { document, workdir, loadMessage, id } = await ready();

  const loadOra = ora(loadMessage).start();

  loadOra.succeed("👍 Document loaded!");

  await writeFile(
    workdir + CONFIG_FILE_NAME,
    JSON.stringify({
      document: document,
      id
    })
  );

  const imageNodes = getImageNodes(document.document);
  const downloadOra = ora("Downloading your Assets...").start();

  let downloaded = 0;

  await Promise.all(
    imageNodes.map(async (current) => {
      const imageUrl = (
        await figma.getImage(id, {
          ids: current,
          format: "svg",
          scale: 1,
        })
      ).images[current];
      if (!imageUrl) return;
      const content = (await axios(imageUrl)).data;
      await writeFile(workdir + "figlit-asasets/" + encodeURIComponent(current) + ".svg", content);

      downloadOra.text = `Downloading your images... ${++downloaded}/${imageNodes.length
        }`;
    })
  );

  downloadOra.succeed("🎉 All images downloaded!");
  process.exit()
})();
