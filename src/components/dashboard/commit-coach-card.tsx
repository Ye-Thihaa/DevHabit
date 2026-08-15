import { Loader2, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";

import { Card } from "@/components/dashboard/card";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";

export function CommitCoachCard() {
  const getFeedback = useAction(api.commitCoach.getCommitMessageFeedback);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await getFeedback({});
      setFeedback(result.feedback);
      setReviewedCount(result.messagesReviewed);
    } catch (err) {
      setError(err instanceof ConvexError ? (err.data as string) : "Failed to get feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Commit message coach"
      description="AI feedback on commit message clarity — reads only the subject lines, never a diff."
      icon={MessageSquareText}
    >
      <Button variant="outline" disabled={loading} onClick={() => void handleGenerate()}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Reviewing…" : "Review my recent commits"}
      </Button>

      {error && <p className="mt-3 font-mono text-xs text-destructive">{error}</p>}

      {feedback && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{feedback}</p>
          {reviewedCount !== null && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Based on {reviewedCount} recent commit message(s).
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        This is about message-writing habits, not code quality — the model never sees a diff, so it
        cannot and does not judge what the commit actually changed.
      </p>
    </Card>
  );
}
