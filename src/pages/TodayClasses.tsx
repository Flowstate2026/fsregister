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
        <div className="mb-8">
          <h2 className="font-display text-3xl font-extrabold text-foreground">
            Today's Classes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{getDayName(today)}</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="rounded-xl border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-muted-foreground">No classes scheduled today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => navigate(`/register/${cls.id}`)}
                className="flex w-full items-center justify-between rounded-xl border bg-card p-5 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.99]"
              >
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {cls.name}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(cls.time_of_day)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {(cls.class_enrollments as any)?.[0]?.count ?? 0} students
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground text-lg">›</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TodayClasses;
