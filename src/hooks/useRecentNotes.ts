import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentNote {
  id: string;
  noteText: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  authorName: string;
}

export function useRecentNotes(limit = 10) {
  return useQuery({
    queryKey: ["recent-notes", limit],
    queryFn: async () => {
      const { data: notes, error } = await supabase
        .from("student_notes")
        .select("*, students(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!notes?.length) return [];

      const authorIds = [...new Set(notes.map((n) => n.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);

      const nameMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.full_name])
      );

      return notes.map((n) => ({
        id: n.id,
        noteText: n.note_text,
        createdAt: n.created_at,
        studentName: `${(n.students as any)?.first_name ?? ""} ${(n.students as any)?.last_name ?? ""}`.trim(),
        authorName: nameMap.get(n.author_id) || "Unknown",
      })) as RecentNote[];
    },
  });
}
