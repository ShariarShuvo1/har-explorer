export interface ConnectionStats {
	connection: string;
	requestCount: number;
	domains: Set<string>;
	totalSize: number;
	avgTime: number;
	protocol: string;
	reused: boolean;
}

export interface InitiatorStats {
	type: string;
	count: number;
	totalSize: number;
	avgTime: number;
	domains: Set<string>;
}

export interface PriorityStats {
	priority: string;
	count: number;
	avgLoadTime: number;
	avgStartTime: number;
	resources: Array<{
		url: string;
		actualStartTime: number;
		duration: number;
	}>;
}

export interface TransferStats {
	domain: string;
	totalTransferSize: number;
	totalContentSize: number;
	headerOverhead: number;
	requestCount: number;
	avgHeaderSize: number;
}

export interface ServerLocationStats {
	serverIP: string;
	domain: string;
	requestCount: number;
	avgLatency: number;
	totalSize: number;
	isCDN: boolean;
	errorCount: number;
}

export interface ResourceSequenceStats {
	resourceType: string;
	count: number;
	avgStartTime: number;
	avgDuration: number;
	totalSize: number;
	parallelism: number;
	blockingCount: number;
}
