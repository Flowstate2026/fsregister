import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Upload, X } from "lucide-react";

interface Props {
  schoolId: string;
}

export default function SchoolDetails({ schoolId }: Props) {
  const [schoolName, setSchoolName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase
      .from("schools")
      .select("name, logo_url, email")
      .eq("id", schoolId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSchoolName(data.name);
          setLogoUrl(data.logo_url);
          setSchoolEmail(data.email || "");
        }
      });
  }, [schoolId]);

  const handleSaveName = async () => {
    if (!schoolName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("schools")
      .update({ name: schoolName.trim(), email: schoolEmail.trim() || null })
      .eq("id", schoolId);
    setSaving(false);
    if (error) toast.error("Failed to update school details");
    else toast.success("School details updated");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${schoolId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("school-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload logo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("school-logos")
      .getPublicUrl(path);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("schools").update({ logo_url: publicUrl }).eq("id", schoolId);
    setLogoUrl(publicUrl);
    setUploading(false);
    toast.success("Logo updated");
  };

  const handleRemoveLogo = async () => {
    await supabase.from("schools").update({ logo_url: null }).eq("id", schoolId);
    setLogoUrl(null);
    toast.success("Logo removed");
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-foreground">
          <Building2 className="w-4 h-4" />
          <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
            School Details
          </h2>
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block">
            Logo
          </label>
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="School logo" className="h-16 w-16 rounded object-contain border border-border/30" />
              <button onClick={handleRemoveLogo} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading…" : "Upload logo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* School name */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block">
            School Name
          </label>
          <div className="flex gap-3">
            <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
        </div>

        {/* School email */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block">
            School Email
          </label>
          <p className="text-[10px] text-muted-foreground">Used as the reply-to address for parent emails</p>
          <div className="flex gap-3">
            <Input type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="hello@yourschool.com" />
          </div>
        </div>

        <Button onClick={handleSaveName} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
