import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertSpecialRule, type InsertAdjustment, type InsertTemplate } from "@shared/schema";

export function useRules() {
  return useQuery({
    queryKey: [api.rules.list.path],
    queryFn: async () => {
      const res = await fetch(api.rules.list.path);
      if (!res.ok) throw new Error("Failed to fetch rules");
      return api.rules.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSpecialRule) => {
      const res = await fetch(api.rules.create.path, {
        method: api.rules.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      return api.rules.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.rules.list.path] }),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.rules.delete.path, { id });
      const res = await fetch(url, { method: api.rules.delete.method });
      if (!res.ok) throw new Error("Failed to delete rule");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.rules.list.path] }),
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rule }: { id: number; rule: Partial<InsertSpecialRule> }) => {
      const url = buildUrl(api.rules.update.path, { id });
      const res = await fetch(url, {
        method: api.rules.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return api.rules.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.rules.list.path] }),
  });
}

export function useAdjustments(filters?: { startDate?: string; endDate?: string; employeeCode?: string; type?: string }) {
  return useQuery({
    queryKey: [api.adjustments.list.path, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters?.startDate) queryParams.append("startDate", filters.startDate);
      if (filters?.endDate) queryParams.append("endDate", filters.endDate);
      if (filters?.employeeCode) queryParams.append("employeeCode", filters.employeeCode);
      if (filters?.type) queryParams.append("type", filters.type);
      const url = queryParams.toString()
        ? `${api.adjustments.list.path}?${queryParams.toString()}`
        : api.adjustments.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch adjustments");
      return api.adjustments.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAdjustment) => {
      const res = await fetch(api.adjustments.create.path, {
        method: api.adjustments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create adjustment");
      return api.adjustments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adjustments.list.path] }),
  });
}

export function useImportAdjustments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { sourceFileName?: string; rows: InsertAdjustment[] }) => {
      const res = await fetch(api.adjustments.import.path, {
        method: api.adjustments.import.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to import adjustments");
      return api.adjustments.import.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.adjustments.list.path] }),
  });
}

export function useMidnightPunches(filters?: {
  startDate?: string;
  endDate?: string;
  employeeCode?: string;
  sector?: string;
  branch?: string;
}) {
  return useQuery({
    queryKey: [api.midnightLinks.list.path, filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters?.startDate) queryParams.append("startDate", filters.startDate);
      if (filters?.endDate) queryParams.append("endDate", filters.endDate);
      if (filters?.employeeCode) queryParams.append("employeeCode", filters.employeeCode);
      if (filters?.sector) queryParams.append("sector", filters.sector);
      if (filters?.branch) queryParams.append("branch", filters.branch);
      const url = queryParams.toString()
        ? `${api.midnightLinks.list.path}?${queryParams.toString()}`
        : api.midnightLinks.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch midnight punches");
      return api.midnightLinks.list.responses[200].parse(await res.json());
    },
  });
}

export function useMidnightLinkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employeeCode: string;
      punchDateTime: string;
      action: "previous_day_checkout" | "current_day_checkin" | "ignore";
      targetBaseDate?: string | null;
      note?: string | null;
    }) => {
      const res = await fetch(api.midnightLinks.action.path, {
        method: api.midnightLinks.action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to apply link action");
      return api.midnightLinks.action.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.midnightLinks.list.path] }),
  });
}

export function useImportMidnightLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { rows: Array<Record<string, string | number | null>> }) => {
      const res = await fetch(api.midnightLinks.import.path, {
        method: api.midnightLinks.import.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to import midnight links");
      return api.midnightLinks.import.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.midnightLinks.list.path] }),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: [api.templates.list.path],
    queryFn: async () => {
      const res = await fetch(api.templates.list.path);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return api.templates.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTemplate) => {
      const res = await fetch(api.templates.create.path, {
        method: api.templates.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return api.templates.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.templates.list.path] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.templates.delete.path, { id });
      const res = await fetch(url, { method: api.templates.delete.method });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.templates.list.path] }),
  });
}
