import { AdvancedFilters } from "@/lib/stores/har-store";

export interface FilterSectionProps {
	advancedFilters: AdvancedFilters;
	setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
}
