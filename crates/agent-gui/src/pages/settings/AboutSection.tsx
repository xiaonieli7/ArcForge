import { Info, Sparkles } from "../../components/icons";
import { useLocale } from "../../i18n";

export function AboutSection() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Info className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("settings.aboutTitle")}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("settings.aboutDescription")}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.aboutCurrentVersion")}
            </div>
            <div className="mt-1 text-2xl font-semibold leading-none tabular-nums">
              v{__ARCFORGE_APP_VERSION__}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/45 px-2.5 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("app.name")}
          </div>
        </div>
      </section>
    </div>
  );
}
