#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseReleaseVersion, tauriVersionConfig } from "./release-version.mjs";

function usage() {
  return [
    "Usage: prepare-app-version-from-tag.mjs <release-tag> [options]",
    "",
    "Options:",
    "  --tauri-config <path>    Write a generated Tauri config overlay with the app version.",
    "  --json                   Print metadata as JSON.",
  ].join("\n");
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    json: false,
    releaseTag: undefined,
    tauriConfigPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    if (arg === "--tauri-config") {
      options.tauriConfigPath = readValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.releaseTag) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    options.releaseTag = arg;
  }

  return options;
}

function writeTauriConfig(path, appVersion) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(tauriVersionConfig(appVersion), null, 2)}\n`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const metadata = parseReleaseVersion(
    options.releaseTag || process.env.RELEASE_TAG,
  );

  if (options.tauriConfigPath) {
    writeTauriConfig(options.tauriConfigPath, metadata.appVersion);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...metadata,
          tauriVersionConfig: options.tauriConfigPath,
        },
        null,
        2,
      ),
    );
  } else {
    const configSuffix = options.tauriConfigPath
      ? ` Wrote Tauri version config: ${options.tauriConfigPath}.`
      : "";
    console.log(
      `Prepared ArcForge local build ${metadata.releaseTag} (app version ${metadata.appVersion}).${configSuffix}`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(1);
}
