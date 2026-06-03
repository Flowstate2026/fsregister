import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { getTodayDayOfWeek, getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users, ChevronRight, Check } from "lucide-react";
import { format } from "date-fns";

const TodayClasses = () => {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const today = getTodayDayOfWeek();
  const todayDate = format(new Date(), "yyyy-MM-dd");

  const { data: classes, isLoading } = useQuery({
    queryKey: ["today-classes", today, user?.id, isOwner, todayDate],
    queryFn: async () => {
      // Teachers see all classes in their school (RLS scopes by school_id)
      const { data, error } = await supabase
        .from("classes")
        .select("*, class_enrollments(count)")
        .order("time_of_day")
        .eq("day_of_week", today);
      if (error) throw error;

      const { data: cancelled } = await supabase
        .from("cancelled_dates")
        .select("class_id")
        .lte("start_date", todayDate)
        .gte("end_date", todayDate);

      if (!cancelled?.length) return data;

      const cancelledClassIds = new Set(cancelled.map((c) => c.class_id));
      const allCancelled = cancelled.some((c) => c.class_id === null);

      if (allCancelled) return [];

      return data?.filter((cls) => !cancelledClassIds.has(cls.id)) || [];
    },
  });

  const classIds = classes?.map((c) => c.id) || [];
  const { data: todayAttendance } = useQuery({
    queryKey: ["today-attendance-status", todayDate, classIds],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("class_id")
        .eq("date", todayDate)
        .in("class_id", classIds);
      if (error) throw error;
      return new Set(data.map((r) => r.class_id));
    },
  });

  const isCompleted = (classId: string) => todayAttendance?.has(classId) ?? false;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-3xl text-foreground">Today's Classes</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">{getDayName(today)}</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="bg-card p-14 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm font-light text-muted-foreground">No classes scheduled today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => {
              const completed = isCompleted(cls.id);
              return (
                <button
                  key={cls.id}
                  onClick={() => navigate(`/register/${cls.id}`)}
                  className="flex w-full items-center justify-between bg-card px-6 py-6 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
                >
                  <div className="flex items-center gap-4">
                    {completed && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <Check className="h-3.5 w-3.5 text-accent" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-lg text-foreground">{cls.name}</h3>
                      <div className="mt-2.5 flex items-center gap-5 text-[11px] font-light tracking-wide text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatTime(cls.time_of_day)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {(cls.class_enrollments as any)?.[0]?.count ?? 0} students
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TodayClasses;
