import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { buildMetadata, viewport as viewportConfig } from "@/lib/seo/metadata";
import { STRUCTURED_DATA, GA_MEASUREMENT_ID } from "@/lib/seo/constants";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import { Providers } from "@/components/app-shell/providers";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const enableAnalytics = process.env.NODE_ENV === "production";

export const metadata: Metadata = buildMetadata();

export const viewport: Viewport = viewportConfig;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: serializeJsonLd(STRUCTURED_DATA),
					}}
				/>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				{enableAnalytics && (
					<>
						<Script
							src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
							strategy="afterInteractive"
						/>
						<Script id="google-analytics" strategy="afterInteractive">
							{`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
						</Script>
					</>
				)}
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
