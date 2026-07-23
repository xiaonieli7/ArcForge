import { memo, type ReactNode } from "react";
import { MonitorSmartphone, Moon, PanelLeft, Settings, Sun } from "../../../components/icons";
import { isMacOsTauri } from "../../../components/MacOsTitleBarSpacer";
import { Button } from "../../../components/ui/button";
import { useLocale } from "../../../i18n";
import { type AppSettings, getNextTheme, type Theme } from "../../../lib/settings";
import { cn } from "../../../lib/shared/utils";
import type { SectionId } from "../../settings/types";

function ThemeToggleIcon(props: { theme: Theme }) {
  if (props.theme === "light") return <Sun className="h-4 w-4" />;
  if (props.theme === "dark") return <Moon className="h-4 w-4" />;
  return <MonitorSmartphone className="h-4 w-4" />;
}

export const ChatHeader = memo(function ChatHeader(props: {
  settings: AppSettings;
  sidebarOpen: boolean;
  onOpenSettings: (section?: SectionId) => void;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
  preThemeActions?: ReactNode;
  trailingActions?: ReactNode;
}) {
  const {
    settings,
    sidebarOpen,
    onOpenSettings,
    onToggleTheme,
    onOpenSidebar,
    preThemeActions,
    trailingActions,
  } = props;
  const { t } = useLocale();
  const nextTheme = getNextTheme(settings.theme);
  const themeToggleTitle =
    nextTheme === "light"
      ? t("tooltip.switchToLight")
      : nextTheme === "dark"
        ? t("tooltip.switchToDark")
        : t("tooltip.switchToAuto");
  const macOsTauri = isMacOsTauri();

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "flex items-center justify-between gap-2 py-2.5 pr-4",
        !sidebarOpen && macOsTauri ? "pl-[232px]" : "pl-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {!sidebarOpen && !macOsTauri ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            title={t("tooltip.openSidebar")}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 -translate-y-px items-center gap-1">
        {preThemeActions}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          title={themeToggleTitle}
          aria-label={themeToggleTitle}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ThemeToggleIcon theme={nextTheme} />
        </Button>
        {!sidebarOpen && !macOsTauri && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenSettings()}
            title={t("tooltip.settings")}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        {trailingActions}
      </div>
    </header>
  );
});
