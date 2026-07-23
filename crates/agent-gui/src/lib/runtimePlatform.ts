import { invoke } from "@tauri-apps/api/core";

export type RuntimePlatform = "windows" | "macos" | "linux";
export type RuntimeCapabilityStatus = "available" | "unavailable" | "unknown";
export type PythonPostgresDriver = "psycopg" | "psycopg2" | "none" | "unknown";
export type RuntimeEnvironmentSource = "backend" | "fallback";

export type RuntimeEnvironmentSnapshot = {
  platform: RuntimePlatform;
  architecture?: string;
  shell: {
    profile: string;
    family: "powershell" | "posix" | "cmd";
    name: "powershell" | "pwsh" | "bash" | "zsh" | "sh" | "cmd";
    usesWsl: boolean;
  };
  commands: {
    python: RuntimeCapabilityStatus;
    node: RuntimeCapabilityStatus;
    psql: RuntimeCapabilityStatus;
    git: RuntimeCapabilityStatus;
    docker: RuntimeCapabilityStatus;
  };
  python: {
    status: RuntimeCapabilityStatus;
    launcher?: "python" | "python3" | "py -3";
    postgresDriver: PythonPostgresDriver;
  };
  source: RuntimeEnvironmentSource;
};

type RuntimePlatformResponse = {
  platform?: unknown;
};

type RuntimeEnvironmentResponse = {
  platform?: unknown;
  architecture?: unknown;
  shell?: unknown;
  commands?: unknown;
  python?: unknown;
};

const CAPABILITY_STATUSES = new Set<RuntimeCapabilityStatus>([
  "available",
  "unavailable",
  "unknown",
]);
const POSTGRES_DRIVERS = new Set<PythonPostgresDriver>([
  "psycopg",
  "psycopg2",
  "none",
  "unknown",
]);
const SHELL_PROFILES = new Set([
  "windows-powershell",
  "windows-pwsh",
  "windows-git-bash",
  "windows-cmd",
  "posix-zsh",
  "posix-bash",
  "posix-sh",
]);
const SHELL_FAMILIES = new Set<RuntimeEnvironmentSnapshot["shell"]["family"]>([
  "powershell",
  "posix",
  "cmd",
]);
const SHELL_NAMES = new Set<RuntimeEnvironmentSnapshot["shell"]["name"]>([
  "powershell",
  "pwsh",
  "bash",
  "zsh",
  "sh",
  "cmd",
]);
const PYTHON_LAUNCHERS = new Set<NonNullable<RuntimeEnvironmentSnapshot["python"]["launcher"]>>([
  "python",
  "python3",
  "py -3",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCapabilityStatus(value: unknown): RuntimeCapabilityStatus {
  return typeof value === "string" && CAPABILITY_STATUSES.has(value as RuntimeCapabilityStatus)
    ? (value as RuntimeCapabilityStatus)
    : "unknown";
}

function defaultShellSnapshot(
  platform: RuntimePlatform,
): RuntimeEnvironmentSnapshot["shell"] {
  if (platform === "windows") {
    return {
      profile: "windows-powershell",
      family: "powershell",
      name: "powershell",
      usesWsl: false,
    };
  }
  if (platform === "macos") {
    return {
      profile: "posix-zsh",
      family: "posix",
      name: "zsh",
      usesWsl: false,
    };
  }
  return {
    profile: "posix-bash",
    family: "posix",
    name: "bash",
    usesWsl: false,
  };
}

function unknownCommandSnapshot(): RuntimeEnvironmentSnapshot["commands"] {
  return {
    python: "unknown",
    node: "unknown",
    psql: "unknown",
    git: "unknown",
    docker: "unknown",
  };
}

export function normalizeRuntimePlatform(value: unknown): RuntimePlatform | undefined {
  if (value === "windows" || value === "macos" || value === "linux") return value;
  return undefined;
}

export function inferRuntimePlatform(): RuntimePlatform {
  const nav =
    typeof navigator !== "undefined"
      ? `${navigator.userAgent || ""} ${navigator.platform || ""}`
      : "";
  if (/\bWindows\b|Win32|Win64|WOW64/i.test(nav)) return "windows";
  if (/Mac|iPhone|iPad|iPod/i.test(nav)) return "macos";
  return "linux";
}

export function runtimePlatformLabel(platform: RuntimePlatform) {
  if (platform === "windows") return "Windows";
  if (platform === "macos") return "macOS";
  return "Linux";
}

export function createFallbackRuntimeEnvironment(
  platform: RuntimePlatform = inferRuntimePlatform(),
): RuntimeEnvironmentSnapshot {
  return {
    platform,
    shell: defaultShellSnapshot(platform),
    commands: unknownCommandSnapshot(),
    python: {
      status: "unknown",
      postgresDriver: "unknown",
    },
    source: "fallback",
  };
}

export function normalizeRuntimeEnvironmentSnapshot(
  value: unknown,
  fallbackPlatform: RuntimePlatform = inferRuntimePlatform(),
): RuntimeEnvironmentSnapshot {
  const response = asRecord(value) as RuntimeEnvironmentResponse;
  const platform = normalizeRuntimePlatform(response.platform) ?? fallbackPlatform;
  const fallback = createFallbackRuntimeEnvironment(platform);
  const shellInput = asRecord(response.shell);
  const commandsInput = asRecord(response.commands);
  const pythonInput = asRecord(response.python);
  const profile =
    typeof shellInput.profile === "string" && SHELL_PROFILES.has(shellInput.profile)
      ? shellInput.profile
      : fallback.shell.profile;
  const family =
    typeof shellInput.family === "string" &&
    SHELL_FAMILIES.has(shellInput.family as RuntimeEnvironmentSnapshot["shell"]["family"])
      ? (shellInput.family as RuntimeEnvironmentSnapshot["shell"]["family"])
      : fallback.shell.family;
  const name =
    typeof shellInput.name === "string" &&
    SHELL_NAMES.has(shellInput.name as RuntimeEnvironmentSnapshot["shell"]["name"])
      ? (shellInput.name as RuntimeEnvironmentSnapshot["shell"]["name"])
      : fallback.shell.name;
  const architecture =
    typeof response.architecture === "string" &&
    /^[A-Za-z0-9_.-]{1,32}$/.test(response.architecture)
      ? response.architecture
      : undefined;
  const launcher =
    typeof pythonInput.launcher === "string" &&
    PYTHON_LAUNCHERS.has(
      pythonInput.launcher as NonNullable<RuntimeEnvironmentSnapshot["python"]["launcher"]>,
    )
      ? (pythonInput.launcher as NonNullable<
          RuntimeEnvironmentSnapshot["python"]["launcher"]
        >)
      : undefined;
  const postgresDriver =
    typeof pythonInput.postgresDriver === "string" &&
    POSTGRES_DRIVERS.has(pythonInput.postgresDriver as PythonPostgresDriver)
      ? (pythonInput.postgresDriver as PythonPostgresDriver)
      : "unknown";

  return {
    platform,
    architecture,
    shell: {
      profile,
      family,
      name,
      usesWsl: shellInput.usesWsl === true,
    },
    commands: {
      python: normalizeCapabilityStatus(commandsInput.python),
      node: normalizeCapabilityStatus(commandsInput.node),
      psql: normalizeCapabilityStatus(commandsInput.psql),
      git: normalizeCapabilityStatus(commandsInput.git),
      docker: normalizeCapabilityStatus(commandsInput.docker),
    },
    python: {
      status: normalizeCapabilityStatus(pythonInput.status),
      launcher,
      postgresDriver,
    },
    source: "backend",
  };
}

export async function resolveRuntimePlatform(): Promise<RuntimePlatform> {
  try {
    const response = await invoke<RuntimePlatformResponse>("app_runtime_platform");
    return normalizeRuntimePlatform(response?.platform) ?? inferRuntimePlatform();
  } catch {
    return inferRuntimePlatform();
  }
}

export async function resolveRuntimeEnvironmentSnapshot(): Promise<RuntimeEnvironmentSnapshot> {
  const fallbackPlatform = inferRuntimePlatform();
  try {
    const response = await invoke<RuntimeEnvironmentResponse>("app_runtime_environment");
    return normalizeRuntimeEnvironmentSnapshot(response, fallbackPlatform);
  } catch {
    return createFallbackRuntimeEnvironment(fallbackPlatform);
  }
}
