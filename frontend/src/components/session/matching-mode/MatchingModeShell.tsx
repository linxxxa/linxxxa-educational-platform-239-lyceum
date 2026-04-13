"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MatchingModeMainContent } from "./MatchingModeMainContent";
import { MatchingModeTopBar } from "./MatchingModeTopBar";
import { useMatchingModeStateMachine } from "./useMatchingModeStateMachine";

export type MatchingModeShellProps = {
  learningTopicId: number;
  pairCountUrlQueryValue?: string | null;
  studyTimerUrlFlag?: string | null;
  onExitMatchingStudyFlow: () => void;
};

/** Корневой layout экрана сопоставления: хук состояния + панели UI. */
export function MatchingModeShell(props: MatchingModeShellProps) {
  const router = useRouter();
  const isStudyTimerEnabled = props.studyTimerUrlFlag === "1";
  const refreshServerComponentsAfterMatchingBatch = useCallback(() => {
    window.setTimeout(() => {
      router.refresh();
    }, 1600);
  }, [router]);
  const viewModel = useMatchingModeStateMachine(
    props.learningTopicId,
    props.pairCountUrlQueryValue,
    isStudyTimerEnabled,
    refreshServerComponentsAfterMatchingBatch
  );
  const goToDashboardWithProgressRefresh = () => {
    window.location.assign("/dashboard?refresh=1");
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <MatchingModeTopBar
          viewModel={viewModel}
          onExitMatchingMode={props.onExitMatchingStudyFlow}
        />
        <MatchingModeMainContent
          viewModel={viewModel}
          onFinishSessionNavigateToDashboard={goToDashboardWithProgressRefresh}
        />
      </div>
    </div>
  );
}
