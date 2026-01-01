import {
	Globe,
	List,
	Send,
	Download,
	Activity,
	Shield,
	Database,
	Zap,
	Terminal,
} from "lucide-react";
import { TabConfig } from "./types";

export const TAB_CONFIG: TabConfig[] = [
	{ id: "general", label: "General", icon: Globe },
	{ id: "headers", label: "Headers", icon: List },
	{ id: "request", label: "Request", icon: Send },
	{ id: "response", label: "Response", icon: Download },
	{ id: "timings", label: "Timings", icon: Activity },
	{ id: "security", label: "Security", icon: Shield },
	{ id: "cache", label: "Cache", icon: Database },
	{ id: "performance", label: "Performance", icon: Zap },
	{ id: "export", label: "Export", icon: Terminal },
];

export const STATUS_COLORS: Record<
	string,
	{ text: string; bg: string; border: string }
> = {
	"1xx": {
		text: "text-blue-400",
		bg: "bg-blue-500/10",
		border: "border-blue-500/30",
	},
	"2xx": {
		text: "text-green-400",
		bg: "bg-green-500/10",
		border: "border-green-500/30",
	},
	"3xx": {
		text: "text-yellow-400",
		bg: "bg-yellow-500/10",
		border: "border-yellow-500/30",
	},
	"4xx": {
		text: "text-orange-400",
		bg: "bg-orange-500/10",
		border: "border-orange-500/30",
	},
	"5xx": {
		text: "text-red-400",
		bg: "bg-red-500/10",
		border: "border-red-500/30",
	},
};

export const TIMING_COLORS: Record<string, string> = {
	primary: "text-primary border-primary/30 bg-primary/10",
	gray: "text-gray-500 border-gray-500/30 bg-gray-500/10",
	cyan: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10",
	orange: "text-orange-500 border-orange-500/30 bg-orange-500/10",
	green: "text-green-500 border-green-500/30 bg-green-500/10",
	blue: "text-blue-500 border-blue-500/30 bg-blue-500/10",
	purple: "text-purple-500 border-purple-500/30 bg-purple-500/10",
	pink: "text-pink-500 border-pink-500/30 bg-pink-500/10",
};

export const TIMING_SEGMENTS = [
	{ label: "Blocked", key: "blocked", color: "bg-gray-500" },
	{ label: "DNS", key: "dns", color: "bg-cyan-500" },
	{ label: "Connect", key: "connect", color: "bg-orange-500" },
	{ label: "SSL", key: "ssl", color: "bg-green-500" },
	{ label: "Send", key: "send", color: "bg-blue-500" },
	{ label: "Wait", key: "wait", color: "bg-purple-500" },
	{ label: "Receive", key: "receive", color: "bg-pink-500" },
] as const;

export const SECURITY_HEADERS = [
	"strict-transport-security",
	"content-security-policy",
	"x-frame-options",
	"x-content-type-options",
	"x-xss-protection",
	"referrer-policy",
	"permissions-policy",
	"cross-origin-embedder-policy",
	"cross-origin-opener-policy",
	"cross-origin-resource-policy",
];

export const CACHE_HEADERS = [
	"cache-control",
	"expires",
	"etag",
	"last-modified",
	"age",
	"pragma",
	"vary",
];
