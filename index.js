#!/usr/bin/env node

const { Api } = require("figma-api");
const axios = require("axios");
const { writeFile, copy, readFile, ensureDir } = require("fs-extra");
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
    rl.question("\n" + message + "\n> ", (answer) => {
      resolve(answer);
      console.log()
    });
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

(async () => {
  const ora = (await import("ora")).default;

  const ready = async () => {
    try {
      const config = JSON.parse(
        await readFile(process.cwd() + "/" + CONFIG_FILE_NAME, {
          encoding: "utf-8",
        })
      );

      const loadOra = ora("Fetching your FIgma Document").start();
      const document = await figma.getFile(config.id, {
        geometry: "paths",
      });
      loadOra.succeed("👍 Document updated!");

      if (config.id)
        return {
          workdir: process.cwd(),
          document,
          id,
          loadOra,
        };

      throw "";
    } catch (e) {
      console.log("\n🚀 Welcome to Figlit!");

      const id = (await ask("Tell me your Figma Document URI")).split("/")[4];

      const loadOra = ora("Fetching your Document").start();
      const document = await figma.getFile(id, {
        geometry: "paths",
      });
      loadOra.succeed("👍 Document loaded!");

      const documentName = await ask(
        `What is your project name? (default: ${document.name})`
      );
      const workdir = `${process.cwd()}/${documentName}/`;

      await copy(__dirname + "/boilerplate", `${workdir}`);

      return {
        workdir,
        document,
        id,
        loadOra,
        isNew: true
      };
    }
  };

  const { document, workdir, id, isNew } = await ready();

  await writeFile(
    workdir + CONFIG_FILE_NAME,
    JSON.stringify({
      document: document,
      id,
    })
  );

  const imageNodes = getImageNodes(document.document);
  const downloadOra = ora("Downloading your Assets...").start();

  let downloaded = 0;

  await ensureDir(workdir + "figlit-assets/");

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
      
      await writeFile(
        workdir + "figlit-assets/" + encodeURIComponent(current) + ".svg",
        content
      );

      downloadOra.text = `Downloading your images... ${++downloaded}/${
        imageNodes.length
      }`;
    })
  );

  downloadOra.succeed("🎉 All images downloaded!");

  if(!isNew) {    
    process.exit();
  }

  console.log("\n😊 New Figlit project has been created!");
  console.log("Go into your project folder and run\n");
  console.log("  cd [YOUR_PROJECT_NAME]");
  console.log("  yarn");
  console.log("  yarn dev\n");
  console.log("👋 Enjoy your Figlit project!\n");
  process.exit();
})();
