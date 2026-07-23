import { useState } from "react";
import { HubBackdrop, HubHeader } from "../../components/hub/HubChrome";
import { Clock3, Zap } from "../../components/icons";
import { useLocale } from "../../i18n";
import type { AppSettings } from "../../lib/settings";
import { cn } from "../../lib/shared/utils";
import { CronSection } from "../settings/CronSection";
import { HooksSection } from "../settings/HooksSection";

type ScheduledView = "cron" | "hooks";

type ScheduledPageProps = {
  settings: AppSettings;
  setSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
};

const SCHEDULED_VIEWS = [
  { id: "cron" as const, labelKey: "scheduled.cronTab", icon: Clock3 },
  { id: "hooks" as const, labelKey: "scheduled.hooksTab", icon: Zap },
];

export function ScheduledPage(props: ScheduledPageProps) {
  const { settings, setSettings, sidebarOpen, onOpenSidebar } = props;
  const { t } = useLocale();
  const [view, setView] = useState<ScheduledView>("cron");

  return (
    <div className="hub-page hub-page-enter relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <HubBackdrop tone="neutral" />

      <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden">
        <HubHeader
          icon={<Clock3 className="h-5 w-5" />}
          title={t("scheduled.title")}
          subtitle={t("scheduled.subtitle")}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={onOpenSidebar}
        />

        <div className="hub-scroll min-h-0 flex-1 overflow-hidden px-5 pb-6 pt-2 sm:px-6 lg:px-8 xl:px-10">
          <div className="hub-content-stage mx-auto flex h-full min-h-0 w-full max-w-[1320px] flex-col gap-4">
            <div className="hub-panel-enter flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-border/45 bg-background/65 p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.04] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
              <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:min-w-[360px]">
                {SCHEDULED_VIEWS.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setView(item.id)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-medium transition-all",
                        active
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 dark:bg-white/[0.09] dark:ring-white/[0.09]"
                          : "text-muted-foreground hover:bg-background/60 hover:text-foreground dark:hover:bg-white/[0.05]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active && item.id === "cron" && "text-blue-500",
                          active && item.id === "hooks" && "text-amber-500",
                        )}
                      />
                      <span>{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="hidden pr-3 text-xs text-muted-foreground lg:block">
                {view === "cron" ? t("settings.cronDesc") : t("settings.hooksDesc")}
              </p>
            </div>

            <div
              key={view}
              className={cn(
                "hub-panel-enter min-h-0 flex-1",
                view === "hooks" ? "overflow-hidden" : "overflow-y-auto pr-1",
              )}
            >
              {view === "cron" ? (
                <CronSection settings={settings} setSettings={setSettings} />
              ) : (
                <HooksSection settings={settings} setSettings={setSettings} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
