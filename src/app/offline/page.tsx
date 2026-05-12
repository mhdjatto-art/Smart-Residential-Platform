import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We can&apos;t reach the network. Once you&apos;re back online, SRP will resync your data automatically.
      </p>
      <a href="/m" className="rounded-md bg-emerald-500 text-white px-4 py-2 text-sm font-semibold">Try again</a>
    </div>
  );
}
