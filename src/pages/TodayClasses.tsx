import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { getTodayDayOfWeek, getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users, ChevronRight } from "lucide-react";

const TodayClasses = () => {
  const navigate = useNavigate();
  const today = getTodayDayOfWeek();

  const { data: classes, isLoading } = useQuery({
    queryKey: ["today-classes", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, class_enrollments(count)")
        .eq("day_of_week", today)
        .order("time_of_day");
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-3xl text-foreground">
            Today's Classes
          </h2>
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
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => navigate(`/register/${cls.id}`)}
                className="flex w-full items-center justify-between bg-card px-6 py-6 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
              >
                <div>
                  <h3 className="font-display text-lg text-foreground">
                    {cls.name}
                  </h3>
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
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TodayClasses;
