import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import {
	generateMetadata,
	viewport as viewportConfig,
} from "@/lib/seo/metadata";
import {
	STRUCTURED_DATA,
	FAQ_STRUCTURED_DATA,
	GA_MEASUREMENT_ID,
} from "@/lib/seo/constants";

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
	verification: {
		google: "fsvwCxiT-jgIJrC7_to1MJ3P48M_ihUAwd7WDBeCVMw",
	},
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
				<Script
					src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
					strategy="afterInteractive"
				/>
				<Script id="google-analytics" strategy="afterInteractive">
					{`
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', '${GA_MEASUREMENT_ID}');
					`}
				</Script>
				{children}
			</body>
		</html>
	);
}
