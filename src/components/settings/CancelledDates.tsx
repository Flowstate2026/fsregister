import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarOff, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  schoolId: string;
}

export default function CancelledDates({ schoolId }: Props) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: cancelledDates, isLoading } = useQuery({
    queryKey: ["cancelled-dates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancelled_dates")
        .select("*, classes(name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!startDate) throw new Error("Start date is required");
      const end = endDate || startDate;
      const { error } = await supabase.from("cancelled_dates").insert({
        school_id: schoolId,
        class_id: classId === "all" ? null : classId,
        start_date: startDate,
        end_date: end,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancelled-dates"] });
      setStartDate("");
      setEndDate("");
      setReason("");
      setClassId("all");
      toast.success("Cancelled dates added");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cancelled_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancelled-dates"] });
      toast.success("Cancellation removed");
    },
    onError: () => toast.error("Failed to remove"),
  });

  const formatDateRange = (start: string, end: string) => {
    const s = format(new Date(start + "T00:00:00"), "d MMM yyyy");
    const e = format(new Date(end + "T00:00:00"), "d MMM yyyy");
    return s === e ? s : `${s} — ${e}`;
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-foreground">
          <CalendarOff className="w-4 h-4" />
          <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
            Cancelled Dates
          </h2>
        </div>

        {/* Add form */}
        <div className="space-y-3">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium">
                Start date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium">
                End date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Input
            placeholder="Reason (optional, e.g. Half term)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <Button
            onClick={() => addMutation.mutate()}
            disabled={!startDate || addMutation.isPending}
            className="w-full"
            size="sm"
          >
            {addMutation.isPending ? "Adding…" : "Add Cancellation"}
          </Button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="h-10 animate-pulse bg-muted/40" />
          ) : !cancelledDates?.length ? (
            <p className="text-xs text-muted-foreground py-2">
              No cancelled dates
            </p>
          ) : (
            cancelledDates.map((cd) => (
              <div
                key={cd.id}
                className="flex items-center justify-between border border-border/30 px-4 py-3 text-sm"
              >
                <div>
                  <span className="text-foreground font-light">
                    {formatDateRange(cd.start_date, cd.end_date)}
                  </span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {(cd as any).classes?.name || "All classes"}
                  </span>
                  {cd.reason && (
                    <span className="ml-2 text-muted-foreground/60 text-xs">
                      · {cd.reason}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(cd.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
