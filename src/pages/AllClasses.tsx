import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { getDayName, formatTime } from "@/lib/student-utils";
import { Clock, Users, ChevronRight } from "lucide-react";

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

  const grouped = (classes || []).reduce<Record<number, typeof classes>>((acc, cls) => {
    if (!acc[cls.day_of_week]) acc[cls.day_of_week] = [];
    acc[cls.day_of_week]!.push(cls);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-10">
          <h2 className="font-display text-2xl font-bold text-foreground">All Classes</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : !classes?.length ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted-foreground">No classes found</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([day, dayClasses]) => (
              <div key={day}>
                <h3 className="mb-3.5 font-display text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {getDayName(parseInt(day))}
                </h3>
                <div className="space-y-2.5">
                  {dayClasses?.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => navigate(`/register/${cls.id}`)}
                      className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card px-6 py-5 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
                    >
                      <div>
                        <h4 className="font-display text-base font-semibold text-foreground">{cls.name}</h4>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {formatTime(cls.time_of_day)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
                            {(cls.class_enrollments as any)?.[0]?.count ?? 0}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
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
