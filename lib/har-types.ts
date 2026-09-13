export interface HARNameValue {
	name: string;
	value: string;
	comment?: string;
}

export interface HARCookie {
	name: string;
	value: string;
	path?: string;
	domain?: string;
	expires?: string | null;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: string;
	[key: string]: unknown;
}

export interface HARPostData {
	mimeType: string;
	text?: string;
	params?: Array<{
		name: string;
		value?: string;
		fileName?: string;
		contentType?: string;
		[key: string]: unknown;
	}>;
	[key: string]: unknown;
}

export interface HARTimings {
	blocked: number;
	dns: number;
	ssl: number;
	connect: number;
	send: number;
	wait: number;
	receive: number;
	[key: string]: number;
}

export interface HAREntry {
	_connectionId?: string;
	_initiator?: unknown;
	_priority?: string;
	_resourceType?: string;
	/** Chrome: "memory" or "disk" when the response came from the browser cache. */
	_fromCache?: string;
	pageref?: string;
	comment?: string;
	cache?: Record<string, unknown>;
	connection?: string;
	request: {
		method: string;
		url: string;
		httpVersion: string;
		headers: HARNameValue[];
		queryString: HARNameValue[];
		cookies: HARCookie[];
		headersSize: number;
		bodySize: number;
		postData?: HARPostData;
	};
	response: {
		status: number;
		statusText: string;
		httpVersion: string;
		headers: HARNameValue[];
		cookies: HARCookie[];
		content: {
			size: number;
			mimeType: string;
			compression?: number;
			text?: string;
			encoding?: string;
		};
		redirectURL: string;
		headersSize: number;
		bodySize: number;
		_transferSize?: number;
		_error?: unknown;
		_fetchedViaServiceWorker?: boolean;
	};
	serverIPAddress?: string;
	startedDateTime: string;
	time: number;
	timings: HARTimings;
}

export interface HARPage {
	id?: string;
	title?: string;
	startedDateTime?: string;
	pageTimings?: {
		onContentLoad?: number;
		onLoad?: number;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface HARLog {
	version: string;
	creator: {
		name: string;
		version: string;
		[key: string]: unknown;
	};
	browser?: {
		name: string;
		version: string;
		[key: string]: unknown;
	};
	pages?: HARPage[];
	entries: HAREntry[];
	comment?: string;
}

export interface HARData {
	log: HARLog;
}

export type ResourceType =
	| "all"
	| "fetch"
	| "doc"
	| "css"
	| "js"
	| "font"
	| "img"
	| "media"
	| "manifest"
	| "ws"
	| "wasm"
	| "other";
