"use client";
import { useState } from "react";
import { Plus, Eye, ListChecks } from "lucide-react";
import type { GroupRoomController } from "./use-room";
import { EmptyState } from "./room-ui";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};
const blank = (): Question => ({
  question: "",
  options: ["", ""],
  correctAnswer: 0,
  explanation: "",
});
export function QuizWorkspace({
  controller,
}: {
  controller: GroupRoomController;
}) {
  const s = controller.snapshot;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Room quiz");
  const [questions, setQuestions] = useState<Question[]>([blank()]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Yes\nAlmost\nNo");
  if (!s) return null;
  const host = s.me.role === "host",
    active = s.room.status === "active",
    quiz = s.quiz;
  const update = (index: number, values: Partial<Question>) =>
    setQuestions((items) =>
      items.map((q, i) => (i === index ? { ...q, ...values } : q)),
    );
  const valid =
    title.trim() &&
    questions.every(
      (q) =>
        q.question.trim().length >= 3 &&
        q.options.every((o) => o.trim()) &&
        q.correctAnswer < q.options.length,
    );
  return (
    <div className="gs-workspace-stack">
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <p className="gs-kicker">
              <ListChecks /> CHECK YOUR UNDERSTANDING
            </p>
            <h2>{quiz?.title ?? "Small questions. Big breakthroughs."}</h2>
            <p className="gs-muted">
              {quiz
                ? `${quiz.responseCount} completed · ${quiz.revealed ? "Answers revealed" : "Answers remain private"}`
                : "Create a quiz manually or use Group LAM with your shared material."}
            </p>
          </div>
          {host && (
            <button
              className="gs-button"
              onClick={() => setCreating(!creating)}
            >
              <Plus />
              {creating ? "Close editor" : "Create quiz"}
            </button>
          )}
        </div>
        {creating && host && (
          <form
            className="gs-quiz-editor"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!valid) return;
              if (await controller.action("quiz", { title, questions })) {
                setCreating(false);
                setQuestions([blank()]);
              }
            }}
          >
            <label className="gs-field">
              Quiz title
              <input
                className="gs-input"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {questions.map((q, qi) => (
              <fieldset key={qi} className="gs-question-editor">
                <legend>Question {qi + 1}</legend>
                <label className="gs-field">
                  Question
                  <textarea
                    className="gs-textarea"
                    rows={2}
                    value={q.question}
                    maxLength={1200}
                    onChange={(e) => update(qi, { question: e.target.value })}
                  />
                </label>
                <div className="gs-options-editor">
                  {q.options.map((option, oi) => (
                    <label className="gs-field" key={oi}>
                      Option {"ABCDEF"[oi]}
                      <input
                        className="gs-input"
                        value={option}
                        maxLength={500}
                        onChange={(e) =>
                          update(qi, {
                            options: q.options.map((o, i) =>
                              i === oi ? e.target.value : o,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="gs-inline">
                  {q.options.length < 6 && (
                    <button
                      className="gs-button"
                      type="button"
                      onClick={() =>
                        update(qi, { options: [...q.options, ""] })
                      }
                    >
                      Add option
                    </button>
                  )}
                  {q.options.length > 2 && (
                    <button
                      className="gs-button"
                      type="button"
                      onClick={() =>
                        update(qi, {
                          options: q.options.slice(0, -1),
                          correctAnswer: Math.min(
                            q.correctAnswer,
                            q.options.length - 2,
                          ),
                        })
                      }
                    >
                      Remove last option
                    </button>
                  )}
                  <label className="gs-field">
                    Correct answer
                    <select
                      className="gs-select"
                      value={q.correctAnswer}
                      onChange={(e) =>
                        update(qi, { correctAnswer: Number(e.target.value) })
                      }
                    >
                      {q.options.map((_, i) => (
                        <option value={i} key={i}>
                          Option {"ABCDEF"[i]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="gs-field">
                  Explanation (optional)
                  <textarea
                    className="gs-textarea"
                    rows={2}
                    maxLength={2000}
                    value={q.explanation}
                    onChange={(e) =>
                      update(qi, { explanation: e.target.value })
                    }
                  />
                </label>
                {questions.length > 1 && (
                  <button
                    className="gs-button gs-button-danger"
                    type="button"
                    onClick={() =>
                      setQuestions((items) => items.filter((_, i) => i !== qi))
                    }
                  >
                    Remove question
                  </button>
                )}
              </fieldset>
            ))}
            <div className="gs-actions">
              {questions.length < 10 && (
                <button
                  className="gs-button"
                  type="button"
                  onClick={() => setQuestions((items) => [...items, blank()])}
                >
                  Add question
                </button>
              )}
              <button
                className="gs-button gs-button-primary"
                disabled={
                  !valid || !active || controller.busyKeys.includes("quiz:")
                }
              >
                Start quiz
              </button>
            </div>
            {!active && (
              <p className="gs-muted">
                Start the room session before publishing a quiz.
              </p>
            )}
          </form>
        )}
        {!quiz && !creating && (
          <EmptyState title="No quiz running.">
            Your host can start a quick check-in. Answers are submitted once and
            stay private; the room sees only aggregate results.
          </EmptyState>
        )}
        {quiz && (
          <>
            <div className="gs-section-head">
              {quiz.revealed ? (
                <span className="gs-status">
                  {quiz.correctPercent ?? 0}% correct · room aggregate
                </span>
              ) : host ? (
                <button
                  className="gs-button gs-button-primary"
                  disabled={controller.busyKeys.includes("reveal:")}
                  onClick={() =>
                    void controller.action("reveal", { quizId: quiz.id })
                  }
                >
                  <Eye />
                  End &amp; reveal answers
                </button>
              ) : (
                <p className="gs-fineprint">
                  Answer once. Only your own responses are visible before
                  reveal.
                </p>
              )}
            </div>
            {quiz.questions.map((q, qi) => (
              <fieldset className="gs-quiz-question" key={q.id}>
                <legend>
                  {qi + 1}. {q.question}
                </legend>
                <div className="gs-list">
                  {q.options.map((option, oi) => {
                    const count = quiz.distribution?.[q.id]?.[oi] ?? 0,
                      total = (quiz.distribution?.[q.id] ?? []).reduce(
                        (a, b) => a + b,
                        0,
                      ),
                      percent = Math.round((100 * count) / Math.max(1, total));
                    return (
                      <button
                        className="gs-quiz-option"
                        key={oi}
                        data-selected={quiz.myAnswers[q.id] === oi}
                        data-correct={quiz.revealed && q.correctAnswer === oi}
                        disabled={
                          !active ||
                          quiz.revealed ||
                          quiz.myAnswers[q.id] !== undefined ||
                          controller.busyKeys.includes(`answer:${q.id}`)
                        }
                        onClick={() =>
                          void controller.action("answer", {
                            quizId: quiz.id,
                            questionId: q.id,
                            answer: oi,
                          })
                        }
                      >
                        <span>{"ABCDEF"[oi]}</span>
                        <span className="gs-option-text">
                          {option}
                          {quiz.revealed && q.correctAnswer === oi
                            ? " ✓ Correct"
                            : ""}
                        </span>
                        {quiz.revealed && (
                          <span className="gs-result-count">
                            {count} · {percent}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {quiz.revealed && q.explanation && (
                  <p className="gs-note">{q.explanation}</p>
                )}
                {!quiz.revealed && quiz.myAnswers[q.id] !== undefined && (
                  <p className="gs-fineprint">
                    Answer saved. Waiting for the reveal.
                  </p>
                )}
              </fieldset>
            ))}
          </>
        )}
      </section>
      <section className="gs-glass gs-card">
        <div className="gs-section-head">
          <div>
            <h2>Quick poll</h2>
            <p className="gs-muted">
              Decide what to study next, or check how everyone feels.
            </p>
          </div>
        </div>
        {s.poll ? (
          <>
            <h3>{s.poll.question}</h3>
            <div className="gs-list">
              {s.poll.options.map((option, i) => (
                <button
                  className="gs-quiz-option"
                  key={i}
                  data-selected={s.poll!.myVote === i}
                  disabled={!active || controller.busyKeys.includes("vote:")}
                  onClick={() =>
                    void controller.action("vote", {
                      pollId: s.poll!.id,
                      option: i,
                    })
                  }
                >
                  <span>{i + 1}</span>
                  <span className="gs-option-text">{option}</span>
                  <small>{s.poll!.counts[i]} votes</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          !host && (
            <EmptyState title="Your voice matters.">
              The host can open a quick poll for everyone.
            </EmptyState>
          )
        )}
        {host && (
          <form
            className="gs-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const options = pollOptions
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean);
              if (
                await controller.action("poll", {
                  question: pollQuestion,
                  options,
                })
              )
                setPollQuestion("");
            }}
          >
            <label className="gs-field">
              Poll question
              <input
                className="gs-input"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={500}
                minLength={3}
                required
              />
            </label>
            <label className="gs-field">
              Options (one per line, 2–6)
              <textarea
                className="gs-textarea"
                value={pollOptions}
                onChange={(e) => setPollOptions(e.target.value)}
                maxLength={1205}
              />
            </label>
            <button
              className="gs-button"
              disabled={
                !active ||
                pollQuestion.trim().length < 3 ||
                pollOptions.split("\n").filter((o) => o.trim()).length < 2 ||
                pollOptions.split("\n").filter((o) => o.trim()).length > 6 ||
                controller.busyKeys.includes("poll:")
              }
            >
              Ask quick poll
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
