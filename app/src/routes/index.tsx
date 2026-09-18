import { createFileRoute } from "@tanstack/react-router";

import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";

export const Route = createFileRoute("/")({
  // No title/description here on purpose: the home page inherits the site's
  // editable page metadata from the root route (title/favicon/og), so a shared
  // link to "/" shows the owner's values. Add a `head` here only to give a
  // SPECIFIC page its own title/description.
  component: Index,
});

// The whole page IS the journey: the scrub controller owns media time, while
// every chapter stays server-rendered in ordinary semantic flow. Compose the
// site's own nav and bespoke CTAs around <ScrollScrub />; the engine
// deliberately ships no header, no shared button system, and no scroll hint.
function Index() {
  return (
    <main>
      <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} />
    </main>
  );
}
