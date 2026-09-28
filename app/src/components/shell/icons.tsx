import { Banknote, ClipboardList, FileText, FlaskConical, History, Inbox, LayoutDashboard, List, Plug, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { IconName } from "./nav";

const MAP = { shield: ShieldCheck, sparkle: Sparkles, wallet: Wallet, file: FileText, layout: LayoutDashboard, list: List, banknote: Banknote, plug: Plug, history: History, inbox: Inbox, clipboard: ClipboardList, flask: FlaskConical };

export function NavIcon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const I = MAP[name];
  return <I className={className} aria-hidden strokeWidth={1.75} />;
}
