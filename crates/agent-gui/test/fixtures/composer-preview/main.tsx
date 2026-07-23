import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MentionComposerHandle } from "../../../src/components/chat/MentionComposer";
import type { GitClient, GitRepositoryState } from "../../../src/lib/git/types";
import type { ModelOption } from "../../../src/lib/providers/llm";
import {
  type ChatRuntimeControls,
  DEFAULT_CHAT_RUNTIME_CONTROLS,
  type ExecutionMode,
} from "../../../src/lib/settings";
import { ChatComposerBar } from "../../../src/pages/chat/components/ChatComposerBar";
import "../../../src/index.css";

const gitState: GitRepositoryState = {
  repoRoot: "E:/ArcForge",
  workdir: "E:/ArcForge",
  head: "master",
  upstream: "origin/master",
  remoteName: "origin",
  remoteUrl: "",
  ahead: 0,
  behind: 0,
  stashCount: 0,
  dirtyCounts: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
  entries: [],
  status: "ready",
};

const gitClient = {
  status: async () => gitState,
  branches: async () => ({
    state: gitState,
    branches: [
      {
        name: "master",
        fullName: "master",
        kind: "local",
        current: true,
        upstream: "origin/master",
        ahead: 0,
        behind: 0,
      },
    ],
  }),
} as GitClient;

const modelOptions: ModelOption[] = [
  {
    value: "codex-main::glm-5.2",
    label: "glm-5.2",
    providerId: "codex-main",
    providerName: "My Claude",
    providerType: "codex",
    model: "glm-5.2",
  },
  {
    value: "codex-main::gpt-5.2-codex",
    label: "gpt-5.2-codex",
    providerId: "codex-main",
    providerName: "My Claude",
    providerType: "codex",
    model: "gpt-5.2-codex",
  },
];

Object.assign(window, {
  __TAURI_INTERNALS__: {
    invoke: async (command: string) => {
      if (command === "fs_mention_list") {
        return {
          entries: [
            { path: "src/App.tsx", kind: "file" },
            { path: "src/pages/ChatPage.tsx", kind: "file" },
            { path: "src/components", kind: "dir" },
          ],
          truncated: false,
        };
      }
      return null;
    },
  },
});

function ComposerPreview() {
  const composerRef = useRef<MentionComposerHandle | null>(null);
  const [controls, setControls] = useState<ChatRuntimeControls>({
    ...DEFAULT_CHAT_RUNTIME_CONTROLS,
    thinkingEnabled: true,
    nativeWebSearchEnabled: false,
    reasoning: "high",
  });
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("tools");
  const [selectedModelValue, setSelectedModelValue] = useState(modelOptions[0].value);
  const selectedModel =
    modelOptions.find((option) => option.value === selectedModelValue) ?? modelOptions[0];

  return (
    <main className="relative h-screen min-h-[340px] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,rgba(37,99,235,0.06),transparent_46%)]" />
      <ChatComposerBar
        composerRef={composerRef}
        isSending={false}
        isUploadingFiles={false}
        isInputDisabled={false}
        inputPlaceholder="输入消息"
        workdir="E:/ArcForge"
        enabledSkills={[
          {
            name: "frontend-design",
            description: "设计并实现高质量前端界面",
            skillFile: "E:/ArcForge/.agents/skills/frontend-design/SKILL.md",
            baseDir: "E:/ArcForge/.agents/skills/frontend-design",
          },
          {
            name: "code-review",
            description: "审查代码并给出改进建议",
            skillFile: "E:/ArcForge/.agents/skills/code-review/SKILL.md",
            baseDir: "E:/ArcForge/.agents/skills/code-review",
          },
        ]}
        isAgentMode
        hasModels
        currentModelLabel={`${selectedModel.providerName} / ${selectedModel.model}`}
        modelOptions={modelOptions}
        selectedModelValue={selectedModelValue}
        executionMode={executionMode}
        chatRuntimeControls={controls}
        reasoningOptions={["low", "medium", "high", "xhigh"]}
        thinkingAlwaysOn={false}
        gitClient={gitClient}
        gitWriteEnabled
        workspaceActivityClient={null}
        onSend={() => undefined}
        onStop={() => undefined}
        onComposerBusyChange={() => undefined}
        onSelectModel={(selection) =>
          setSelectedModelValue(`${selection.customProviderId}::${selection.model}`)
        }
        onSelectExecutionMode={(mode) => setExecutionMode(mode)}
        onChatRuntimeControlsChange={(patch) =>
          setControls((current) => ({ ...current, ...patch }))
        }
        onPickReadableFiles={() => undefined}
        onPasteFiles={() => undefined}
        pendingUploadedFiles={[]}
        onRemovePendingUpload={() => undefined}
        queuedTurns={[]}
        onRunQueuedTurnNow={() => undefined}
        onMoveQueuedTurnUp={() => undefined}
        onEditQueuedTurn={() => undefined}
        onRemoveQueuedTurn={() => undefined}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ComposerPreview />);
