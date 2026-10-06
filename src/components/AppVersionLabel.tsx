import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { APP_VERSION_ANDROID } from "@/lib/version";

// Single version label used by all layouts. On native builds it shows the
// REAL version from Info.plist / build.gradle (synced from version.ts by
// apps/update-config.cjs); on web it falls back to the Android-lineage value.
export default function AppVersionLabel({ className }: { className?: string }) {
  const [label, setLabel] = useState(APP_VERSION_ANDROID);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    App.getInfo()
      .then((i) => {
        if (i.version) setLabel(i.build ? `${i.version}(${i.build})` : i.version);
      })
      .catch(() => {
        // keep the constant fallback
      });
  }, []);

  return <div className={className}>Version {label}</div>;
}
