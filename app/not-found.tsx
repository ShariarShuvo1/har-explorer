import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
	title: "Page not found",
	robots: { index: false, follow: true },
};

export default function NotFound() {
	return (
		<main className="flex min-h-dvh items-center justify-center p-6">
			<Empty className="max-w-md border-0">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileQuestion />
					</EmptyMedia>
					<p className="text-sm font-medium text-muted-foreground">404</p>
					<EmptyTitle className="text-2xl">Page not found</EmptyTitle>
					<EmptyDescription>
						The page you&apos;re looking for doesn&apos;t exist or has been moved.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild>
						<Link href="/">
							<ArrowLeft />
							Back to HAR Explorer
						</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</main>
	);
}
