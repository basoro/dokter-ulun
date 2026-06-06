import { useState, useCallback } from 'react';

interface UsePaginationProps {
  initialPage?: number;
  initialItemsPerPage?: number;
  onPaginationChange?: (page: number, itemsPerPage: number) => void;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export function usePagination({
  initialPage = 1,
  initialItemsPerPage = 10,
  onPaginationChange,
}: UsePaginationProps = {}) {
  const [paginationState, setPaginationState] = useState<PaginationState>({
    currentPage: initialPage,
    itemsPerPage: initialItemsPerPage,
    totalItems: 0,
    totalPages: 0,
  });

  const updatePagination = useCallback((data: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  }) => {
    setPaginationState(prev => ({
      ...prev,
      totalItems: data.total ?? prev.totalItems,
      currentPage: data.page ?? prev.currentPage,
      itemsPerPage: data.limit ?? prev.itemsPerPage,
      totalPages: data.totalPages ?? prev.totalPages,
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPaginationState(prev => ({
      ...prev,
      currentPage: page,
    }));
    onPaginationChange?.(page, paginationState.itemsPerPage);
  }, [onPaginationChange, paginationState.itemsPerPage]);

  const handleItemsPerPageChange = useCallback((itemsPerPage: number) => {
    setPaginationState(prev => ({
      ...prev,
      itemsPerPage,
      currentPage: 1, // Reset to first page when changing items per page
    }));
    onPaginationChange?.(1, itemsPerPage);
  }, [onPaginationChange]);

  const resetPagination = useCallback(() => {
    setPaginationState(prev => ({
      ...prev,
      currentPage: 1,
    }));
  }, []);

  const getPaginationParams = useCallback(() => ({
    page: paginationState.currentPage.toString(),
    itemsPerPage: paginationState.itemsPerPage.toString(),
  }), [paginationState.currentPage, paginationState.itemsPerPage]);

  return {
    paginationState,
    updatePagination,
    handlePageChange,
    handleItemsPerPageChange,
    resetPagination,
    getPaginationParams,
  };
}