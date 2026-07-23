import { useEffect, useState } from "react";

import iconSimpleUrl from "../../../../src-tauri/icons/icon-simple.png";
import { Settings } from "../../../components/icons";
import { useLocale } from "../../../i18n";
import type { SectionId } from "../../settings/types";

type GreetingPeriod = "morning" | "noon" | "afternoon" | "evening" | "night";

const GREETING_KEYS: Record<GreetingPeriod, string> = {
  morning: "chat.greetingMorning",
  noon: "chat.greetingNoon",
  afternoon: "chat.greetingAfternoon",
  evening: "chat.greetingEvening",
  night: "chat.greetingNight",
};

function resolveGreetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "noon";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

function useGreetingPeriod() {
  const [period, setPeriod] = useState<GreetingPeriod>(() =>
    resolveGreetingPeriod(new Date().getHours()),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPeriod(resolveGreetingPeriod(new Date().getHours()));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return period;
}

export type ChatEmptyStateProps = {
  variant: "no-models" | "start-chat";
  onOpenSettings?: (section?: SectionId) => void;
};

export function ChatEmptyState({ variant, onOpenSettings }: ChatEmptyStateProps) {
  const { t } = useLocale();
  const period = useGreetingPeriod();

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="chat-hero-logo-enter relative mb-5 flex h-14 w-14 items-center justify-center">
        {/* Idle float lives on an inner wrapper so its transform never fights
            the entrance animation on the outer node. */}
        <div className="chat-hero-logo-float relative flex h-full w-full items-center justify-center">
          <div
            aria-hidden="true"
            className="chat-hero-halo-breathe absolute inset-1 rounded-full bg-sky-500/10 blur-xl dark:bg-sky-400/10"
          />
          <img
            src={iconSimpleUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="relative h-12 w-12 select-none object-contain"
          />
        </div>
      </div>

      {variant === "no-models" ? (
        <>
          <div className="chat-hero-title-enter mb-1.5 text-center text-[calc(22px*var(--zone-font-scale,1))] font-semibold leading-7 tracking-tight text-foreground">
            {t("chat.welcome")}
          </div>
          <div className="chat-hero-line-enter mb-2 text-center text-sm leading-5 text-muted-foreground">
            {t("chat.brandPositioning")}
          </div>
          <div className="chat-hero-line-enter mb-0.5 text-center text-sm leading-5 text-muted-foreground">
            {t("chat.noModelSelected")}
          </div>
          <div className="chat-hero-line-enter text-center text-sm leading-5 text-muted-foreground">
            {t("chat.configureModel")}
          </div>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={() => onOpenSettings("providers")}
              className="chat-hero-cta-enter mt-5 inline-flex h-8 items-center gap-2 rounded-lg bg-foreground/[0.05] px-3 text-sm font-normal text-foreground/85 transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Settings className="h-4 w-4 text-foreground/65" />
              {t("chat.goToSettings")}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="chat-hero-title-enter whitespace-nowrap text-center text-[calc(20px*var(--zone-font-scale,1))] font-semibold leading-7 tracking-tight text-foreground">
            {t(GREETING_KEYS[period])}
            {t("chat.greetingSeparator")}
            {t("chat.greetingSubtitle")}
          </div>
          <div className="chat-hero-line-enter mt-2 max-w-[680px] px-6 text-center text-sm leading-6 text-muted-foreground">
            {t("chat.brandPromise")}
          </div>
        </>
      )}
    </div>
  );
}
