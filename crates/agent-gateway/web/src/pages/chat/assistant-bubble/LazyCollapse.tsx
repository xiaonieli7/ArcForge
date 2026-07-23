import { type ReactNode, useState } from "react";

import { cn } from "../../../lib/shared/utils";

// Collapsible region whose body mounts on first expand and stays mounted
// forever after. Collapsed-from-birth content costs nothing — no Streamdown
// parse, no shiki highlight, no diff build, no DOM — which is what makes
// scrolling a settled transcript cheap; once revealed it keeps its state
// exactly like the old always-mounted markup (the settle zero-remount
// invariant holds because the latch lives in components whose keys carry
// over).
//
// The height change lands in a single commit — deliberately no
// grid-template-rows transition. A layout animation resizes the virtualized
// row on every frame, and each of those frames costs a measurement pass over
// the rows below plus a React commit and scroll compensation: the longer the
// conversation, the worse the jank. Instead the revealed content plays a
// compositor-only opacity/translate entrance (the same snap-layout,
// animate-content pattern as the right dock's collapse), so the virtualizer
// sees exactly one resize per toggle.
export function LazyCollapse(props: {
  open: boolean;
  className?: string;
  children: () => ReactNode;
}) {
  const { open, className, children } = props;
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) {
    // Render-phase latch: the body mounts in the same commit as the expand.
    setMounted(true);
  }

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid",
        open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {mounted ? (
          // Dropping the class on collapse resets the CSS animation, so
          // every re-expand replays the entrance.
          <div className={open ? "lazy-collapse-reveal" : "invisible"}>{children()}</div>
        ) : null}
      </div>
    </div>
  );
}
