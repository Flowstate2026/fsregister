import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users } from "lucide-react";

const AllClasses = () => {
  const navigate = useNavigate();

  const { data: classes, isLoading } = useQuery({
    queryKey: ["all-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, class_enrollments(count)")
        .order("day_of_week")
        .order("time_of_day");
      if (error) throw error;
      return data;
    },
  });

  // Group by day
  const grouped = (classes || []).reduce<Record<number, typeof classes>>((acc, cls) => {
    if (!acc[cls.day_of_week]) acc[cls.day_of_week] = [];
    acc[cls.day_of_week]!.push(cls);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">All Classes</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No classes found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([day, dayClasses]) => (
              <div key={day}>
                <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {getDayName(parseInt(day))}
                </h3>
                <div className="space-y-2">
                  {dayClasses?.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => navigate(`/register/${cls.id}`)}
                      className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
                    >
                      <div>
                        <h4 className="font-display font-semibold text-foreground">{cls.name}</h4>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(cls.time_of_day)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {(cls.class_enrollments as any)?.[0]?.count ?? 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-muted-foreground">›</div>
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

export default AllClasses;
