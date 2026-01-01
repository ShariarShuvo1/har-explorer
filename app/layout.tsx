import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
	generateMetadata,
	viewport as viewportConfig,
} from "@/lib/seo/metadata";
import { STRUCTURED_DATA, FAQ_STRUCTURED_DATA } from "@/lib/seo/constants";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const baseUrl =
	process.env.PUBLIC_DEPLOYED_URL || "https://har-explorer.vercel.app";

export const metadata: Metadata = {
	...generateMetadata(baseUrl),
	icons: {
		icon: [{ url: "/icon.png", type: "image/png" }],
		apple: [{ url: "/icon.png", type: "image/png" }],
	},
};

export const viewport: Viewport = viewportConfig;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(STRUCTURED_DATA),
					}}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(FAQ_STRUCTURED_DATA),
					}}
				/>
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
