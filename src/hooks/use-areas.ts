import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAreas,
  fetchAreaById,
  createArea,
  updateArea,
  deleteArea,
} from "@/services/area";
import type { CreateAreaRequest, UpdateAreaRequest } from "@/types/area";

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: fetchAreas,
  });
}

export function useAreaById(id: string) {
  return useQuery({
    queryKey: ["areas", id],
    queryFn: () => fetchAreaById(id),
    enabled: !!id,
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAreaRequest) => createArea(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
  });
}

export function useUpdateArea(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAreaRequest) => updateArea(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["areas", id] });
    },
  });
}

export function useDeleteArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
    },
  });
}
