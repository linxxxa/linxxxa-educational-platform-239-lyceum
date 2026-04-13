import type { MatchingRoundState } from "./matchingModeTypes";
import type { MatchingModeViewModel } from "./useMatchingModeStateMachine";

function MatchingModeSetupPhaseSubtitle(props: {
  topicDeckCardsCount: number;
}) {
  return (
    <>
      Выберите число пар · в колоде {props.topicDeckCardsCount} подходящих
    </>
  );
}

function MatchingModeCompletePhaseSubtitle(props: {
  roundState: MatchingRoundState;
}) {
  const offline = props.roundState.syncPhase === "offline";
  return (
    <>
      {offline ? "Результат сохранён локально" : "Прогресс на сервере обновлён"}
    </>
  );
}

function MatchingModePlayPhaseSubtitle(props: {
  roundState: MatchingRoundState;
  isStudyTimerEnabled: boolean;
  minutesTwoDigits: string;
  secondsTwoDigits: string;
}) {
  const { roundState, isStudyTimerEnabled, minutesTwoDigits, secondsTwoDigits } =
    props;
  const timerPart = isStudyTimerEnabled
    ? `Время: ${minutesTwoDigits}:${secondsTwoDigits}`
    : "Без таймера";
  return (
    <>
      {timerPart} · пар: {roundState.roundCards.length}
      {roundState.syncPhase === "submitting" ? " · Сохраняем…" : ""}
      {roundState.syncPhase === "admiring" ? " · Граф готов" : ""}
    </>
  );
}

/** Подзаголовок панели: зависит от фазы раунда. */
export function MatchingModeStatusSubtitle(props: {
  viewModel: MatchingModeViewModel;
}) {
  const { viewModel } = props;
  if (viewModel.roundState.phase === "setup") {
    return (
      <MatchingModeSetupPhaseSubtitle
        topicDeckCardsCount={viewModel.deckMeta.topicDeckCards.length}
      />
    );
  }
  if (viewModel.roundState.phase === "complete") {
    return (
      <MatchingModeCompletePhaseSubtitle roundState={viewModel.roundState} />
    );
  }
  return (
    <MatchingModePlayPhaseSubtitle
      roundState={viewModel.roundState}
      isStudyTimerEnabled={viewModel.isStudyTimerEnabled}
      minutesTwoDigits={viewModel.minutesTwoDigits}
      secondsTwoDigits={viewModel.secondsTwoDigits}
    />
  );
}
