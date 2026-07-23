import type { Tool, ToolCall, ToolResultMessage } from "@earendil-works/pi-ai";
import { invoke } from "@tauri-apps/api/core";
import { Type } from "typebox";

import { type BuiltinToolBundle, createBuiltinMetadataMap } from "./builtinTypes";

type OfficeRuntimeResponse = {
  success: boolean;
  exitCode?: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
  runtime: string;
  runtimePath: string;
};

type OfficeRuntimeCancelResponse = {
  cancelled: boolean;
};

const OFFICE_RUNTIME_TOOL_NAME = "OfficeRuntime";
const SPREADSHEET_CODE_TOOL_NAME = "SpreadsheetCode";
const OFFICE_RUNTIME_ARGUMENTS = new Set([
  "document",
  "action",
  "spec_path",
  "input_path",
  "output_path",
  "force",
  "timeout_seconds",
]);
const SPREADSHEET_CODE_ARGUMENTS = new Set([
  "script_path",
  "input_path",
  "output_path",
  "force",
  "timeout_seconds",
]);

const officeRuntimeTool: Tool = {
  name: OFFICE_RUNTIME_TOOL_NAME,
  description:
    "Create, patch, inspect, or render Office deliverables with ArcForge's bundled local runtime. " +
    "Use document=spreadsheet for XLSX create/patch/inspect and document=presentation for PPTX " +
    "create/inspect or PDF render. Paths must stay inside the current workspace.",
  parameters: Type.Object(
    {
      document: Type.Union([Type.Literal("spreadsheet"), Type.Literal("presentation")]),
      action: Type.Union([
        Type.Literal("create"),
        Type.Literal("patch"),
        Type.Literal("inspect"),
        Type.Literal("render"),
      ]),
      spec_path: Type.Optional(
        Type.String({ description: "Workspace JSON specification path for create or patch." }),
      ),
      input_path: Type.Optional(
        Type.String({
          description: "Workspace XLSX or PPTX input path for patch, inspect, or render.",
        }),
      ),
      output_path: Type.Optional(
        Type.String({ description: "Workspace XLSX, PPTX, or PDF destination path." }),
      ),
      force: Type.Optional(
        Type.Boolean({
          description: "Overwrite the exact destination only when the user explicitly approved it.",
        }),
      ),
      timeout_seconds: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 600,
          description: "Execution timeout in seconds; defaults to 180.",
        }),
      ),
    },
    { additionalProperties: false },
  ),
};

const spreadsheetCodeTool: Tool = {
  name: SPREADSHEET_CODE_TOOL_NAME,
  description:
    "Run a reviewed workbook-only Python script with ArcForge's bundled spreadsheet runtime. " +
    "The script receives an in-memory workbook and approved openpyxl helpers, cannot import modules " +
    "or access paths, and must leave loading and saving to ArcForge. Use this only when structured " +
    "OfficeRuntime create/patch operations are insufficient.",
  parameters: Type.Object(
    {
      script_path: Type.String({
        description: "Workspace .py file containing workbook-only transformation code.",
      }),
      input_path: Type.Optional(
        Type.String({
          description: "Optional workspace XLSX input; omit to start with a new workbook.",
        }),
      ),
      output_path: Type.String({ description: "Workspace XLSX destination path." }),
      force: Type.Optional(
        Type.Boolean({
          description: "Overwrite the exact destination only when the user explicitly approved it.",
        }),
      ),
      timeout_seconds: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 600,
          description: "Execution timeout in seconds; defaults to 180.",
        }),
      ),
    },
    { additionalProperties: false },
  ),
};

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `office-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function requestCancellation(requestId: string) {
  void (async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await invoke<OfficeRuntimeCancelResponse>("office_runtime_cancel", {
          request_id: requestId,
        });
        if (response.cancelled) return;
      } catch {
        return;
      }
      await delay(50);
    }
  })();
}

function validateArguments(
  args: unknown,
  toolName: string,
  allowedArguments: ReadonlySet<string>,
): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error(`${toolName} arguments must be an object`);
  }
  const values = args as Record<string, unknown>;
  const unknown = Object.keys(values).filter((key) => !allowedArguments.has(key));
  if (unknown.length > 0) {
    throw new Error(`${toolName} received unsupported arguments: ${unknown.join(", ")}`);
  }
  return values;
}

function resultText(result: OfficeRuntimeResponse) {
  if (result.success) {
    const truncation =
      result.stdoutTruncated || result.stderrTruncated
        ? "\nwarning: runtime output was truncated"
        : "";
    return `${result.stdout.trim() || "Office Runtime completed successfully."}${truncation}`;
  }
  if (result.cancelled) return "Office Runtime execution was cancelled.";
  if (result.timedOut) return "Office Runtime execution timed out.";
  return (
    result.stderr.trim() ||
    result.stdout.trim() ||
    `Office Runtime failed with exit code ${result.exitCode ?? "unknown"}.`
  );
}

export function createOfficeRuntimeTools(params: { workdir: string }): BuiltinToolBundle {
  async function executeToolCall(
    toolCall: ToolCall,
    signal?: AbortSignal,
  ): Promise<ToolResultMessage> {
    const timestamp = Date.now();
    if (
      toolCall.name !== OFFICE_RUNTIME_TOOL_NAME &&
      toolCall.name !== SPREADSHEET_CODE_TOOL_NAME
    ) {
      return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Unknown tool: ${toolCall.name}` }],
        details: {},
        isError: true,
        timestamp,
      };
    }
    if (signal?.aborted) {
      return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: "Cancelled" }],
        details: {},
        isError: true,
        timestamp,
      };
    }

    const requestId = createRequestId();
    const onAbort = () => requestCancellation(requestId);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const isSpreadsheetCode = toolCall.name === SPREADSHEET_CODE_TOOL_NAME;
      const args = validateArguments(
        toolCall.arguments,
        toolCall.name,
        isSpreadsheetCode ? SPREADSHEET_CODE_ARGUMENTS : OFFICE_RUNTIME_ARGUMENTS,
      );
      const timeoutSeconds =
        typeof args.timeout_seconds === "number" ? args.timeout_seconds : undefined;
      const result = await invoke<OfficeRuntimeResponse>("office_runtime_execute", {
        input: {
          requestId,
          workdir: params.workdir,
          documentType: isSpreadsheetCode ? "spreadsheet" : args.document,
          action: isSpreadsheetCode ? "code" : args.action,
          specPath: args.spec_path,
          scriptPath: args.script_path,
          inputPath: args.input_path,
          outputPath: args.output_path,
          force: args.force === true,
          timeoutMs: timeoutSeconds === undefined ? undefined : timeoutSeconds * 1_000,
        },
      });
      let parsedOutput: unknown;
      if (result.stdout.trim()) {
        try {
          parsedOutput = JSON.parse(result.stdout);
        } catch {
          parsedOutput = undefined;
        }
      }
      return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: resultText(result) }],
        details: { ...result, parsedOutput },
        isError: !result.success,
        timestamp,
      };
    } catch (error) {
      return {
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: `Office Runtime failed: ${asErrorMessage(error)}` }],
        details: {},
        isError: true,
        timestamp,
      };
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    groupId: "office",
    tools: [officeRuntimeTool, spreadsheetCodeTool],
    executeToolCall,
    metadataByName: createBuiltinMetadataMap([
      [
        OFFICE_RUNTIME_TOOL_NAME,
        {
          groupId: "office",
          kind: "office_runtime",
          isReadOnly: false,
          displayCategory: "file",
        },
      ],
      [
        SPREADSHEET_CODE_TOOL_NAME,
        {
          groupId: "office",
          kind: "spreadsheet_code",
          isReadOnly: false,
          displayCategory: "file",
        },
      ],
    ]),
  };
}
