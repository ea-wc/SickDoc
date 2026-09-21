"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import type { MatchingSuggestion, Symptom } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { InitialsAvatar } from "@/components/shared/initials-avatar";

export default function GuidedMatchPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  const symptoms = useQuery({
    queryKey: ["symptoms"],
    queryFn: () => api<{ data: Symptom[] }>("/symptoms?pageSize=100"),
  });

  const suggest = useMutation({
    mutationFn: () =>
      api<{ matchedSymptoms: { id: string; label: string; source: string }[]; suggestions: MatchingSuggestion[] }>("/matching/suggest", {
        method: "POST",
        body: JSON.stringify({ symptomIds: selected, freeText: freeText.trim() || undefined, limit: 5 }),
      }),
  });

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Guided match</h1>
        <p className="text-sm text-muted-foreground">Describe your symptoms and see ranked, explainable suggestions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What&apos;s bothering you?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {symptoms.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(symptoms.data?.data ?? []).map((symptom) => {
                const active = selected.includes(symptom.id);
                return (
                  <Button
                    key={symptom.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => toggle(symptom.id)}
                  >
                    {symptom.label}
                  </Button>
                );
              })}
            </div>
          )}
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="…or type in plain words, e.g. “tight chest when climbing stairs”"
          />
          <Button
            onClick={() => suggest.mutate()}
            disabled={suggest.isPending || (selected.length === 0 && !freeText.trim())}
          >
            {suggest.isPending ? "Matching…" : "Get suggestions"}
          </Button>
        </CardContent>
      </Card>

      {suggest.isError && <p className="text-sm text-destructive">{suggest.error instanceof Error ? suggest.error.message : "Matching failed"}</p>}

      {suggest.data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Matched symptoms:</span>
            {suggest.data.matchedSymptoms.map((symptom) => (
              <Badge key={symptom.id} variant="secondary">
                {symptom.label}
              </Badge>
            ))}
          </div>

          {(suggest.data.suggestions.length ?? 0) === 0 ? (
            <EmptyState icon={Sparkles} title="No suggestions" description="Try different symptoms or text." />
          ) : (
            <div className="grid gap-4">
              {suggest.data.suggestions.map((suggestion, index) => (
                <Card key={suggestion.doctor.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
                    <InitialsAvatar displayName={suggestion.doctor.displayName} color={suggestion.doctor.avatarColor} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {index + 1}. {suggestion.doctor.displayName}
                        </p>
                        <Badge variant="default">{suggestion.score} pts</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.doctor.yearsOfExperience} years · {suggestion.doctor.specializations.map((s) => s.name).join(", ")}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <p>
                          Matched specialties:{" "}
                          {suggestion.rationale.specializations.map((s) => `${s.name} (+${s.weight})`).join(", ") || "none"}
                        </p>
                        <p>
                          Availability bonus: +{suggestion.rationale.availabilityBonus} · Experience bonus: +{suggestion.rationale.experienceBonus}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/patient/doctors/${suggestion.doctor.id}`}>View &amp; book</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
