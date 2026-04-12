import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Send, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface NoteData {
  note: { id: string; text: string; date: string };
  student: { firstName: string; lastName: string };
  school: { name: string; logoUrl: string | null };
  teacher: { name: string };
  className: string;
  replies: { id: string; reply_text: string; parent_name: string | null; created_at: string }[];
  expired: boolean;
}

export default function ParentNote() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<NoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [parentName, setParentName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      setLoading(false);
      return;
    }

    const fetchNote = async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-parent-note?token=${token}`;
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 410) setError("This link has expired.");
        else setError(json.error || "Something went wrong.");
      } else {
        setData(json);
      }
      setLoading(false);
    };

    fetchNote();
  }, [token]);

  const handleReply = async () => {
    if (!replyText.trim() || !token) return;
    setSending(true);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "parent-reply",
        { body: { token, reply_text: replyText.trim(), parent_name: parentName.trim() || null } }
      );

      if (fnError) throw fnError;
      setSent(true);
    } catch {
      setError("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C4704B] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          {error.includes("expired") ? (
            <Clock className="h-12 w-12 text-[#b0a494] mx-auto" />
          ) : (
            <AlertCircle className="h-12 w-12 text-[#b0a494] mx-auto" />
          )}
          <h1 className="text-xl font-medium text-[#3d2e1f]">
            {error.includes("expired") ? "Link Expired" : "Something went wrong"}
          </h1>
          <p className="text-sm text-[#8a7b6b]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="max-w-lg mx-auto px-6 py-12">
        {/* School header */}
        <div className="text-center mb-10">
          {data.school.logoUrl && (
            <img
              src={data.school.logoUrl}
              alt={data.school.name}
              className="h-14 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-lg font-medium text-[#3d2e1f]">{data.school.name}</h1>
        </div>

        {/* Note card */}
        <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-medium text-[#3d2e1f] mb-1">
              A note about {data.student.firstName}
            </h2>
            <p className="text-xs text-[#8a7b6b] tracking-wide">
              {data.className && <>{data.className} · </>}
              {format(new Date(data.note.date), "d MMMM yyyy")}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#b0a494] mb-2">
              From {data.teacher.name}
            </p>
            <p className="text-[15px] text-[#3d2e1f] leading-relaxed font-light">
              {data.note.text}
            </p>
          </div>

          {/* Previous replies */}
          {data.replies.length > 0 && (
            <div className="border-t border-[#f0ebe4] pt-6 mb-6">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#b0a494] mb-4">
                Replies
              </p>
              {data.replies.map((reply) => (
                <div key={reply.id} className="mb-4 last:mb-0">
                  <p className="text-sm text-[#3d2e1f] leading-relaxed font-light">
                    {reply.reply_text}
                  </p>
                  <p className="mt-1 text-[10px] text-[#b0a494]">
                    {reply.parent_name || "Parent"} · {format(new Date(reply.created_at), "d MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          {sent ? (
            <div className="border-t border-[#f0ebe4] pt-6 text-center">
              <CheckCircle className="h-8 w-8 text-[#6b8e6b] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#3d2e1f]">Reply sent!</p>
              <p className="text-xs text-[#8a7b6b] mt-1">
                {data.teacher.name} will receive your message.
              </p>
            </div>
          ) : (
            <div className="border-t border-[#f0ebe4] pt-6 space-y-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-[#b0a494]">
                Reply to {data.teacher.name}
              </p>
              <Input
                placeholder="Your name (optional)"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="border-[#e8e0d6] bg-[#faf8f5] text-[#3d2e1f] placeholder:text-[#b0a494] focus-visible:ring-[#C4704B]/30"
              />
              <Textarea
                placeholder="Write your reply here…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                className="border-[#e8e0d6] bg-[#faf8f5] text-[#3d2e1f] placeholder:text-[#b0a494] focus-visible:ring-[#C4704B]/30 resize-none"
              />
              <Button
                onClick={handleReply}
                disabled={!replyText.trim() || sending}
                className="bg-[#C4704B] hover:bg-[#a85d3d] text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending…" : "Send Reply"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-[#b0a494]">
          This is a private message from {data.school.name}. Please do not share this link.
        </p>
      </div>
    </div>
  );
}
