import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Clock, Save, X, Pencil } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  day_of_week: number;
  time_of_day: string;
}

const DAY_NAMES = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface Props {
  schoolId: string;
}

export default function ClassesSection({ schoolId }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState<number>(1);
  const [editTime, setEditTime] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, day_of_week, time_of_day")
      .eq("school_id", schoolId)
      .order("day_of_week", { ascending: true })
      .order("time_of_day", { ascending: true });

    if (error) {
      toast.error("Failed to load classes");
      return;
    }
    setClasses(data || []);
  };

  useEffect(() => {
    fetchClasses();
  }, [schoolId]);

  const formatTime = (t: string) => (t ? t.slice(0, 5) : "");

  const handleEdit = (cls: ClassItem) => {
    setEditingId(cls.id);
    setEditDay(cls.day_of_week);
    setEditTime(formatTime(cls.time_of_day));
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditDay(1);
    setEditTime("");
  };

  const handleSave = async (classId: string) => {
    if (!editTime.trim()) {
      toast.error("Please enter a time");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("classes")
      .update({ day_of_week: editDay, time_of_day: editTime.trim() })
      .eq("id", classId)
      .eq("school_id", schoolId);
    setSaving(false);

    if (error) {
      toast.error("Failed to update class");
      return;
    }

    toast.success("Class updated");
    setEditingId(null);
    fetchClasses();
  };

  const dayLabel = (day: number) =>
    DAY_NAMES.find((d) => d.value === day)?.label || "Unknown";

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <CalendarDays className="w-4 h-4" />
          <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
            Classes
          </h2>
        </div>

        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes found.</p>
        ) : (
          <div className="space-y-0">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {cls.name}
                  </p>
                  {editingId === cls.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Select
                        value={String(editDay)}
                        onValueChange={(v) => setEditDay(Number(v))}
                      >
                        <SelectTrigger className="h-9 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_NAMES.map((d) => (
                            <SelectItem
                              key={d.value}
                              value={String(d.value)}
                              className="text-xs"
                            >
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Clock className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          type="time"
                          step={60}
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="h-9 w-32 pl-7 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleSave(cls.id)}
                        disabled={saving}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={handleCancel}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {dayLabel(cls.day_of_week)} at {cls.time_of_day}
                    </p>
                  )}
                </div>
                {editingId !== cls.id && (
                  <button
                    onClick={() => handleEdit(cls)}
                    className="p-2 text-muted-foreground hover:text-accent transition-colors"
                    title="Edit day and time"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
