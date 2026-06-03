import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import SchoolDetails from "@/components/settings/SchoolDetails";
import ManageTeachers from "@/components/settings/ManageTeachers";
import CancelledDates from "@/components/settings/CancelledDates";
import AccountSection from "@/components/settings/AccountSection";
import ClassesSection from "@/components/settings/ClassesSection";


export default function Settings() {
  const { profile, isOwner, loading } = useAuth();
  const schoolId = profile?.school_id;
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .single()
      .then(({ data }) => {
        if (data) setSchoolName(data.name);
      });
  }, [schoolId]);

  if (!loading && !isOwner) return <Navigate to="/" replace />;
  if (!schoolId) return null;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-10">
        <div>
          <h1 className="font-display text-2xl text-foreground">Settings</h1>
          <p className="mt-1 text-xs text-muted-foreground tracking-wide">
            Manage your school and team
          </p>
        </div>

        <SchoolDetails schoolId={schoolId} />
        <ManageTeachers schoolId={schoolId} />
        <CancelledDates schoolId={schoolId} />
        
        <AccountSection schoolId={schoolId} schoolName={schoolName} />
      </div>
    </AppLayout>
  );
}
