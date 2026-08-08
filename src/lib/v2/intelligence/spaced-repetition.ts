/**
 * Scholar Intelligence — Spaced Repetition Engine.
 *
 * SM-2-flavored scheduler for flashcards, definitions, formulas, mistakes,
 * concepts and generated questions. Review states:
 *
 *   NEW → LEARNING → REVIEW → MATURE, with RELEARNING after lapses.
 *
 * Ratings: Again / Hard / Good / Easy. "Again" schedules a same-day retry
 * (10 minutes) instead of discarding the item, and conservative ease decay
 * keeps intervals from exploding.
 */

import { DAY_MS, MINUTE_MS, type ReviewRating, type ReviewSchedule, type SpacedState } from "./types";

export const INITIAL_SCHEDULE: ReviewSchedule = {
  state: "NEW",
  intervalDays: 0,
  ease: 2.5,
  dueAt: 0,
  reviewCount: 0,
  lapses: 0,
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const AGAIN_DELAY_MS = 10 * MINUTE_MS;
const MATURE_INTERVAL_DAYS = 21;

export function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
}

/** Interval multiplier per rating applied on top of the current interval. */
export function nextIntervalDays(current: ReviewSchedule, rating: ReviewRating): number {
  const ease = clampEase(current.ease);
  switch (rating) {
    case "again":
      return 0;
    case "hard":
      return Math.max(1, Math.round(current.intervalDays * 1.2));
    case "good": {
      if (current.state === "NEW") return 1;
      if (current.state === "LEARNING") return 3;
      return Math.max(1, Math.round(current.intervalDays * ease));
    }
    case "easy": {
      if (current.state === "NEW") return 4;
      if (current.state === "LEARNING") return 7;
      return Math.max(1, Math.round(current.intervalDays * ease * 1.3));
    }
  }
}

export function nextState(current: ReviewSchedule, rating: ReviewRating, intervalDays: number): SpacedState {
  switch (rating) {
    case "again":
      return current.state === "REVIEW" || current.state === "MATURE" ? "RELEARNING" : "LEARNING";
    case "hard":
      if (intervalDays <= 1) return "LEARNING";
      return current.state === "MATURE" ? "REVIEW" : current.state === "NEW" ? "LEARNING" : current.state;
    case "good":
      if (current.state === "NEW" || current.state === "LEARNING" || current.state === "RELEARNING") return "REVIEW";
      return intervalDays >= MATURE_INTERVAL_DAYS ? "MATURE" : "REVIEW";
    case "easy":
      return intervalDays >= MATURE_INTERVAL_DAYS ? "MATURE" : "REVIEW";
  }
}

export function nextReview(current: ReviewSchedule, rating: ReviewRating, now = Date.now()): ReviewSchedule {
  const interval = nextIntervalDays(current, rating);
  const state = nextState(current, rating, interval);
  const easeDelta = rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : rating === "again" ? -0.2 : 0;
  const ease = clampEase(current.ease + easeDelta);
  const dueAt = interval === 0 ? now + AGAIN_DELAY_MS : now + interval * DAY_MS;
  return {
    state,
    intervalDays: interval,
    ease,
    dueAt,
    reviewCount: current.reviewCount + 1,
    lapses: current.lapses + (rating === "again" ? 1 : 0),
  };
}

/** When a fresh item is created, it is due immediately. */
export function newDueItem(now = Date.now()): ReviewSchedule {
  return { ...INITIAL_SCHEDULE, dueAt: now };
}

export function isDue(schedule: ReviewSchedule, now = Date.now()): boolean {
  return schedule.dueAt <= now;
}

export function stateLabel(state: SpacedState): string {
  switch (state) {
    case "NEW": return "New";
    case "LEARNING": return "Learning";
    case "REVIEW": return "Review";
    case "MATURE": return "Mature";
    case "RELEARNING": return "Relearning";
  }
}

/** Human-readable next review description. */
export function dueLabel(schedule: ReviewSchedule, now = Date.now()): string {
  const diffMs = schedule.dueAt - now;
  if (diffMs <= 0) return "due now";
  const minutes = Math.round(diffMs / MINUTE_MS);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}
