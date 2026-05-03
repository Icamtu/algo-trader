import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe,
  Home,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Network,
  Radar,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  TrendingUp,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface MarketNavbarProps {
  className?: string;
  activeTab?: string;
}

const navGroups: NavGroup[] = [
  {
    label: "Home",
    shortLabel: "Home",
    icon: Home,
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/aetherdesk", icon: Home, label: "AetherDesk Hub" },
    ],
  },
  {
    label: "Execution",
    shortLabel: "Exec",
    icon: Cpu,
    items: [
      { to: "/execution/command-center", icon: Cpu, label: "Command Center" },
      { to: "/execution/registry", icon: Activity, label: "Strategy Monitor" },
      { to: "/strategy-lab", icon: GitBranch, label: "Strategy Lab" },
      { to: "/aetherdesk/strategy-registry", icon: Database, label: "Strategy Registry" },
      { to: "/aetherdesk/action-center", icon: Terminal, label: "Action Center" },
      { to: "/aetherdesk/analyzer", icon: Radar, label: "Analyzer" },
      { to: "/aetherdesk/playground", icon: FlaskConical, label: "Playground" },
    ],
  },
  {
    label: "Intelligence",
    shortLabel: "Intel",
    icon: LineChart,
    items: [
      { to: "/intelligence", icon: Activity, label: "Intelligence Hub" },
      { to: "/intelligence/regime", icon: Gauge, label: "Regime" },
      { to: "/intelligence/research", icon: Search, label: "Research" },
      { to: "/scanner", icon: Radar, label: "Scanner" },
      { to: "/intelligence/gex", icon: BarChart3, label: "GEX" },
      { to: "/intelligence/historify", icon: Database, label: "Historify" },
      { to: "/intelligence/option-chain", icon: Boxes, label: "Option Chain" },
      { to: "/intelligence/oi-profile", icon: BarChart3, label: "OI Profile" },
      { to: "/intelligence/oi-tracker", icon: Activity, label: "OI Tracker" },
      { to: "/intelligence/vol-surface", icon: LineChart, label: "Vol Surface" },
      { to: "/intelligence/iv-smile", icon: TrendingUp, label: "IV Smile" },
      { to: "/intelligence/iv-chart", icon: LineChart, label: "IV Chart" },
      { to: "/intelligence/max-pain", icon: Shield, label: "Max Pain" },
      { to: "/intelligence/straddle-lab", icon: FlaskConical, label: "Straddle Lab" },
      { to: "/intelligence/indicator-factory", icon: SlidersHorizontal, label: "Indicator Factory" },
    ],
  },
  {
    label: "Trading",
    shortLabel: "Trade",
    icon: Landmark,
    items: [
      { to: "/aetherdesk/orders", icon: ClipboardList, label: "Orders" },
      { to: "/aetherdesk/trades", icon: Zap, label: "Trades" },
      { to: "/aetherdesk/positions", icon: LayoutGrid, label: "Positions" },
      { to: "/aetherdesk/holdings", icon: ShieldCheck, label: "Holdings" },
      { to: "/portfolio", icon: Briefcase, label: "Portfolio" },
      { to: "/pnl-tracker", icon: BarChart3, label: "PnL Tracker" },
      { to: "/journal", icon: BookOpen, label: "Trade Journal" },
      { to: "/charting", icon: TrendingUp, label: "Charting" },
      { to: "/terminal", icon: Terminal, label: "Expert Terminal" },
    ],
  },
  {
    label: "Sandbox",
    shortLabel: "Sim",
    icon: FlaskConical,
    items: [
      { to: "/aetherdesk/simulation", icon: SlidersHorizontal, label: "Simulation Config" },
      { to: "/aetherdesk/simulation/pnl", icon: BarChart3, label: "Simulation P&L" },
      { to: "/aetherdesk/sandbox", icon: FlaskConical, label: "Sandbox Hub" },
      { to: "/aetherdesk/sandbox/trades", icon: Zap, label: "Sandbox Trades" },
      { to: "/aetherdesk/sandbox/orderbook", icon: ClipboardList, label: "Sandbox Orders" },
      { to: "/aetherdesk/sandbox/positions", icon: LayoutGrid, label: "Sandbox Positions" },
      { to: "/aetherdesk/sandbox/logs", icon: BookOpen, label: "Sandbox Logs" },
      { to: "/aetherdesk/sandbox/summary", icon: Activity, label: "Sandbox Summary" },
    ],
  },
  {
    label: "Operations",
    shortLabel: "Ops",
    icon: Shield,
    items: [
      { to: "/risk", icon: Shield, label: "Risk" },
      { to: "/alerts", icon: Bell, label: "Alerts" },
      { to: "/governance", icon: Server, label: "Governance" },
      { to: "/aetherdesk/audit", icon: ShieldCheck, label: "Audit Center" },
      { to: "/aetherdesk/health", icon: Activity, label: "Health Monitor" },
      { to: "/aetherdesk/logs", icon: BookOpen, label: "Logs" },
    ],
  },
  {
    label: "System",
    shortLabel: "Sys",
    icon: Settings,
    items: [
      { to: "/brokers", icon: Globe, label: "Brokers" },
      { to: "/aetherdesk/broker", icon: Globe, label: "Broker Select" },
      { to: "/aetherdesk/connectivity", icon: Network, label: "Connectivity" },
      { to: "/aetherdesk/master-contract", icon: Database, label: "Master Contract" },
      { to: "/aetherdesk/vault", icon: Briefcase, label: "Asset Vault" },
      { to: "/roles", icon: UsersRound, label: "Roles" },
      { to: "/profile", icon: UserRound, label: "Profile" },
      { to: "/profile/preferences", icon: Settings, label: "Preferences" },
      { to: "/profile/charts", icon: LineChart, label: "Charts" },
      { to: "/profile/api-keys", icon: KeyRound, label: "API Keys" },
      { to: "/profile/backtest", icon: SlidersHorizontal, label: "Backtest Defaults" },
    ],
  },
];

const isRouteActive = (pathname: string, route: string) => pathname === route;

const titleFromSegment = (segment: string) =>
  segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const findCurrentItem = (pathname: string) => {
  const allItems = navGroups.flatMap((group) => group.items.map((item) => ({ group, item })));
  return allItems
    .filter(({ item }) => isRouteActive(pathname, item.to))
    .sort((a, b) => b.item.to.length - a.item.to.length)[0];
};

function BreadcrumbContext({ pathname }: { pathname: string }) {
  const current = findCurrentItem(pathname);
  const groupLabel = current?.group.label ?? "Workspace";
  const pageLabel = current?.item.label ?? titleFromSegment(pathname.split("/").filter(Boolean).at(-1) || "Dashboard");

  return (
    <Breadcrumb className="hidden min-w-[190px] max-w-[330px] shrink-0 px-3 md:block">
      <BreadcrumbList className="flex-nowrap gap-1 text-xs">
        <BreadcrumbItem>
          <span className="truncate text-white/40">{groupLabel}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-white/20" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate font-semibold text-white/80">{pageLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function GroupDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isGroupActive = group.items.some((item) => isRouteActive(pathname, item.to));
  const useDenseGrid = group.items.length > 8;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70",
            isGroupActive
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-white/10 bg-white/[0.025] text-white/65 hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          )}
          aria-label={`Open ${group.label} navigation`}
        >
          <group.icon className="size-4" />
          <span className="hidden 2xl:inline">{group.label}</span>
          <span className="2xl:hidden">{group.shortLabel}</span>
          <ChevronDown className="size-3 text-current/55" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "border-white/10 bg-[#0A0A0A] p-1.5 shadow-xl",
          useDenseGrid ? "w-[430px]" : "w-60"
        )}
      >
        <div className={cn(useDenseGrid && "grid grid-cols-2 gap-1")}>
          {group.items.map((item) => {
            const isActive = isRouteActive(pathname, item.to);

            return (
              <DropdownMenuItem key={item.to} asChild>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded px-2.5 py-2 text-xs transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-white/35")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketNavbar({ className }: MarketNavbarProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 flex h-11 shrink-0 items-center overflow-hidden border-b border-white/10 bg-[#070707]",
        className
      )}
      aria-label="Workspace navigation"
    >
      <BreadcrumbContext pathname={pathname} />

      <div className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto border-l border-white/5 px-2 no-scrollbar">
        {navGroups.map((group) => (
          <GroupDropdown key={group.label} group={group} pathname={pathname} />
        ))}
      </div>

      <div className="hidden h-full shrink-0 items-center border-l border-white/5 px-3 md:flex">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] px-2.5 py-1.5">
          <span className="size-1.5 rounded-full bg-secondary" />
          <span className="text-xs font-semibold text-white/55">Sync active</span>
        </div>
      </div>
    </nav>
  );
}
