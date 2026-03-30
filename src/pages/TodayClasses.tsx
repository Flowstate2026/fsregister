import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { getTodayDayOfWeek, getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users } from "lucide-react";

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
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Today's Classes
          </h2>
          <p className="text-sm text-muted-foreground">{getDayName(today)}</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No classes scheduled today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => navigate(`/register/${cls.id}`)}
                className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <div>
                  <h3 className="font-display font-semibold text-foreground">
                    {cls.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(cls.time_of_day)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {(cls.class_enrollments as any)?.[0]?.count ?? 0} students
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground">›</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TodayClasses;
