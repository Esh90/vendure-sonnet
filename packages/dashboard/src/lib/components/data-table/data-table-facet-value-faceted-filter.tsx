import { Badge } from '@/vdb/components/ui/badge.js';
import { Button } from '@/vdb/components/ui/button.js';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/vdb/components/ui/command.js';
import { Popover, PopoverContent, PopoverTrigger } from '@/vdb/components/ui/popover.js';
import { Separator } from '@/vdb/components/ui/separator.js';
import { api } from '@/vdb/graphql/api.js';
import { graphql } from '@/vdb/graphql/graphql.js';
import { cn } from '@/vdb/lib/utils.js';
import { Trans, useLingui } from '@lingui/react/macro';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';
import { Check, ChevronRight, FilterIcon, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { DataTableFacetedFilterProps } from './data-table-faceted-filter.js';

interface FacetValue {
    id: string;
    name: string;
    code: string;
    facet: { id: string; name: string; code: string };
}

const getFacetValueListDocument = graphql(`
    query GetFacetValueListForFilter($options: FacetValueListOptions) {
        facetValues(options: $options) {
            items {
                id
                name
                code
                facet {
                    id
                    name
                    code
                }
            }
            totalItems
        }
    }
`);

const getFacetListDocument = graphql(`
    query GetFacetListForFilter($options: FacetListOptions) {
        facets(options: $options) {
            items {
                id
                name
                code
            }
            totalItems
        }
    }
`);

const getFacetValuesForFacetDocument = graphql(`
    query GetFacetValuesForFacetFilter($options: FacetValueListOptions) {
        facetValues(options: $options) {
            items {
                id
                name
                code
                facet {
                    id
                    name
                    code
                }
            }
            totalItems
        }
    }
`);

const PAGE_SIZE = 10;

/**
 * @description
 * A faceted filter component for filtering by facet values. Designed to be used
 * with the `facetedFilters` prop on the `ListPage` or `PaginatedListDataTable` components.
 *
 * Unlike the standard `DataTableFacetedFilter` which uses pre-defined options, this component
 * supports server-side search and paginated browsing using the same UX as the `FacetValueSelector`.
 *
 * @example
 * ```tsx
 * <ListPage
 *   listQuery={productListDocument}
 *   additionalColumns={{
 *     facetValueId: {
 *       header: '',
 *       cell: () => null,
 *       enableSorting: false,
 *       enableHiding: false,
 *       enableColumnFilter: false,
 *     },
 *   }}
 *   facetedFilters={{
 *     facetValueId: {
 *       title: t`Facet values`,
 *       component: FacetValueFacetedFilter,
 *     },
 *   }}
 * />
 * ```
 *
 * @docsCategory components
 * @since 3.5.0
 */
export function FacetValueFacetedFilter<TData, TValue>({
    column,
    title,
}: DataTableFacetedFilterProps<TData, TValue>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFacetId, setExpandedFacetId] = useState<string | null>(null);
    const [browseMode, setBrowseMode] = useState(true);
    const debouncedSearch = useDebounce(searchTerm, 200);
    const { t } = useLingui();
    const minSearchLength = 1;

    // Track known facet values so we can display names for selected IDs
    const [knownValues, setKnownValues] = useState<Map<string, FacetValue>>(new Map());

    // Current selection from column filter state
    const filterValue = column?.getFilterValue();
    const selectedIds = filterValue
        ? new Set(Object.values(filterValue as Record<string, string>))
        : new Set<string>();

    // Fetch facet value details for selected IDs not yet in knownValues (e.g. after page reload)
    const unknownSelectedIds = Array.from(selectedIds).filter(id => !knownValues.has(id));
    useQuery({
        queryKey: ['facetValuesFilter', 'resolve', unknownSelectedIds],
        queryFn: async () => {
            const result = await api.query(getFacetValueListDocument, {
                options: { filter: { id: { in: unknownSelectedIds } } },
            });
            const items = result.facetValues.items ?? [];
            setKnownValues(prev => {
                const next = new Map(prev);
                for (const fv of items) {
                    next.set(fv.id, fv);
                }
                return next;
            });
            return result;
        },
        enabled: unknownSelectedIds.length > 0,
    });

    // Search facet values by name
    const { data: facetValueData, isLoading: isLoadingFacetValues } = useQuery({
        queryKey: ['facetValuesFilter', debouncedSearch],
        queryFn: () => {
            if (debouncedSearch.length < minSearchLength) {
                return { facetValues: { items: [], totalItems: 0 } };
            }
            return api.query(getFacetValueListDocument, {
                options: {
                    filter: { name: { contains: debouncedSearch } },
                    take: 100,
                },
            });
        },
        enabled: debouncedSearch.length >= minSearchLength && !expandedFacetId,
    });

    // Search facets by name
    const { data: facetSearchData, isLoading: isLoadingFacetSearch } = useQuery({
        queryKey: ['facetsFilter', debouncedSearch],
        queryFn: () => {
            if (debouncedSearch.length < minSearchLength) {
                return { facets: { items: [], totalItems: 0 } };
            }
            return api.query(getFacetListDocument, {
                options: {
                    filter: { name: { contains: debouncedSearch } },
                    take: 100,
                },
            });
        },
        enabled: !browseMode && debouncedSearch.length >= minSearchLength && !expandedFacetId,
    });

    // Browse facets with pagination
    const {
        data: facetBrowseData,
        isLoading: isLoadingFacetBrowse,
        fetchNextPage: fetchNextFacetsPage,
        hasNextPage: hasNextFacetsPage,
        isFetchingNextPage: isFetchingNextFacetsPage,
    } = useInfiniteQuery({
        queryKey: ['facetsFilter', 'browse'],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await api.query(getFacetListDocument, {
                options: {
                    filter: {},
                    sort: { name: 'ASC' },
                    skip: pageParam * PAGE_SIZE,
                    take: PAGE_SIZE,
                },
            });
            return response.facets;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage) return undefined;
            const totalFetched = allPages.length * PAGE_SIZE;
            return totalFetched < lastPage.totalItems ? allPages.length : undefined;
        },
        enabled: browseMode && !expandedFacetId,
        initialPageParam: 0,
    });

    // Browse facet values within a specific facet
    const {
        data: expandedFacetData,
        isLoading: isLoadingExpandedFacet,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['facetValuesFilter', expandedFacetId, 'infinite'],
        queryFn: async ({ pageParam = 0 }) => {
            if (!expandedFacetId) return null;
            const response = await api.query(getFacetValuesForFacetDocument, {
                options: {
                    filter: { facetId: { eq: expandedFacetId } },
                    sort: { code: 'ASC' },
                    skip: pageParam * PAGE_SIZE,
                    take: PAGE_SIZE,
                },
            });
            return response.facetValues;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage) return undefined;
            const totalFetched = allPages.length * PAGE_SIZE;
            return totalFetched < lastPage.totalItems ? allPages.length : undefined;
        },
        enabled: !!expandedFacetId,
        initialPageParam: 0,
    });

    const facetValues = facetValueData?.facetValues.items ?? [];
    const facets = browseMode
        ? (facetBrowseData?.pages.flatMap(page => page?.items ?? []) ?? [])
        : (facetSearchData?.facets.items ?? []);
    const expandedFacetValues = expandedFacetData?.pages.flatMap(page => page?.items ?? []) ?? [];
    const expandedFacetName = expandedFacetValues[0]?.facet.name;

    // Group search results by facet
    const facetGroups = facetValues.reduce<Record<string, FacetValue[]>>((groups, fv) => {
        const facetId = fv.facet.id;
        if (!groups[facetId]) {
            groups[facetId] = [];
        }
        groups[facetId].push(fv);
        return groups;
    }, {});

    const isLoading =
        isLoadingFacetValues || isLoadingFacetSearch || isLoadingFacetBrowse || isLoadingExpandedFacet;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrolledToBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 1;
        if (scrolledToBottom && !isFetchingNextPage) {
            if (expandedFacetId && hasNextPage) {
                void fetchNextPage();
            }
            if (browseMode && !expandedFacetId && hasNextFacetsPage) {
                void fetchNextFacetsPage();
            }
        }
    };

    const toggleValue = (fv: FacetValue) => {
        const next = new Set(selectedIds);
        if (next.has(fv.id)) {
            next.delete(fv.id);
        } else {
            next.add(fv.id);
            setKnownValues(prev => new Map(prev).set(fv.id, fv));
        }
        const arr = Array.from(next);
        column?.setFilterValue(arr.length > 0 ? arr : undefined);
    };

    const selectedLabels = Array.from(selectedIds)
        .map(id => {
            const fv = knownValues.get(id);
            return fv ? `${fv.facet.name}: ${fv.name}` : id;
        });

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <FilterIcon />
                    {title}
                    {selectedIds.size > 0 && (
                        <>
                            <Separator orientation="vertical" className="mx-2 h-4" />
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                                {selectedIds.size}
                            </Badge>
                            <div className="hidden space-x-1 lg:flex">
                                {selectedIds.size > 2 ? (
                                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                        {selectedIds.size} selected
                                    </Badge>
                                ) : (
                                    selectedLabels.map(label => (
                                        <Badge
                                            key={label}
                                            variant="secondary"
                                            className="rounded-sm px-1 font-normal"
                                        >
                                            {label}
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={t`Search facet values...`}
                        value={searchTerm}
                        onValueChange={value => {
                            setSearchTerm(value);
                            setExpandedFacetId(null);
                            if (value.length >= minSearchLength) {
                                setBrowseMode(false);
                            } else {
                                setBrowseMode(true);
                            }
                        }}
                    />
                    <CommandList className="h-[250px] overflow-y-auto" onScroll={handleScroll}>
                        <CommandEmpty>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            ) : debouncedSearch.length < minSearchLength && !browseMode ? (
                                <div className="flex flex-col items-center gap-2 py-4">
                                    <div className="text-sm text-muted-foreground">
                                        <Trans>Type to search or browse below</Trans>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">
                                    <Trans>No results found</Trans>
                                </div>
                            )}
                        </CommandEmpty>

                        {expandedFacetId ? (
                            <>
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => {
                                            setExpandedFacetId(null);
                                            setBrowseMode(true);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        ← <Trans>Back</Trans>
                                    </CommandItem>
                                </CommandGroup>
                                <CommandGroup heading={expandedFacetName}>
                                    {expandedFacetValues.map(fv => {
                                        const isSelected = selectedIds.has(fv.id);
                                        return (
                                            <CommandItem
                                                key={fv.id}
                                                value={fv.id}
                                                onSelect={() => toggleValue(fv)}
                                            >
                                                <div
                                                    className={cn(
                                                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                                        isSelected
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'opacity-50 [&_svg]:invisible',
                                                    )}
                                                >
                                                    <Check />
                                                </div>
                                                {fv.name}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                                {(isFetchingNextPage || isLoadingExpandedFacet) && (
                                    <div className="flex items-center justify-center py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {facets.length > 0 && (
                                    <>
                                        <CommandGroup heading={<Trans>Facets</Trans>}>
                                            {facets.map(facet => (
                                                <CommandItem
                                                    key={facet.id}
                                                    value={`facet-${facet.id}`}
                                                    onSelect={() => setExpandedFacetId(facet.id)}
                                                    className="cursor-pointer"
                                                >
                                                    <span className="flex-1">{facet.name}</span>
                                                    <ChevronRight className="h-4 w-4" />
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        {browseMode && isFetchingNextFacetsPage && (
                                            <div className="flex items-center justify-center py-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                        )}
                                    </>
                                )}

                                {Object.entries(facetGroups).map(([facetId, values]) => (
                                    <CommandGroup key={facetId} heading={values[0]?.facet.name}>
                                        {values.map(fv => {
                                            const isSelected = selectedIds.has(fv.id);
                                            return (
                                                <CommandItem
                                                    key={fv.id}
                                                    value={fv.id}
                                                    onSelect={() => toggleValue(fv)}
                                                >
                                                    <div
                                                        className={cn(
                                                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                                            isSelected
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'opacity-50 [&_svg]:invisible',
                                                        )}
                                                    >
                                                        <Check />
                                                    </div>
                                                    {fv.name}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                ))}
                            </>
                        )}
                    </CommandList>
                    {selectedIds.size > 0 && (
                        <>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => column?.setFilterValue(undefined)}
                                    className="justify-center text-center"
                                >
                                    <Trans>Clear filters</Trans>
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
