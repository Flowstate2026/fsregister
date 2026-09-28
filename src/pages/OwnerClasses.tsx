import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

const OwnerClasses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, isOwner, loading } = useAuth();
  const schoolId = profile?.school_id;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("17:00");
  const [saving, setSaving] = useState(false);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["owner-classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, class_enrollments(count)")
        .eq("school_id", schoolId!)
        .order("day_of_week")
        .order("time_of_day");
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!schoolId || !name.trim() || !time) {
      toast.error("Please enter a name and time");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("classes")
      .insert({ school_id: schoolId, name: name.trim(), day_of_week: day, time_of_day: time });
    setSaving(false);
    if (error) {
      toast.error("Failed to create class");
      return;
    }
    toast.success("Class created");
    setAdding(false);
    setName("");
    queryClient.invalidateQueries({ queryKey: ["owner-classes"] });
  };

  if (!loading && !isOwner) return <Navigate to="/" replace />;

  const grouped = (classes || []).reduce<Record<number, typeof classes>>((acc, cls) => {
    if (!acc[cls.day_of_week]) acc[cls.day_of_week] = [];
    acc[cls.day_of_week]!.push(cls);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12 flex items-center justify-between gap-4">
          <h2 className="font-display text-3xl text-foreground">Classes</h2>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> New class
            </Button>
          )}
        </div>

        {adding && (
          <div className="mb-10 flex flex-wrap items-center gap-3 bg-card p-5 shadow-[var(--shadow-card)]">
            <Input placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 flex-1 min-w-[180px]" />
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (<SelectItem key={d} value={String(d)}>{getDayName(d)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-32" />
            <Button size="sm" onClick={handleCreate} disabled={saving}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map((i) => (<div key={i} className="h-20 animate-pulse bg-muted/40" />))}</div>
        ) : !classes?.length ? (
          <div className="bg-card p-14 text-center shadow-[var(--shadow-card)]"><p className="text-sm font-light text-muted-foreground">No classes found</p></div>
        ) : (
          <div className="space-y-12">
            {Object.entries(grouped).map(([day, dayClasses]) => (
              <div key={day}>
                <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">{getDayName(parseInt(day))}</h3>
                <div className="divide-y divide-border/40">
                  {dayClasses?.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => navigate(`/owner-classes/${cls.id}`)}
                      className="flex w-full items-center justify-between bg-card px-6 py-6 text-left transition-all hover:bg-secondary/30 active:scale-[0.995]"
                    >
                      <div>
                        <h4 className="font-display text-lg text-foreground">{cls.name}</h4>
                        <div className="mt-2.5 flex items-center gap-5 text-[11px] font-light tracking-wide text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{formatTime(cls.time_of_day)}</span>
                          <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{(cls.class_enrollments as any)?.[0]?.count ?? 0}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OwnerClasses;
