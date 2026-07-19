import { navigateTo } from "@/lib/nav-event";

export type MathsEbookDestination = "Library" | "Reader" | "Questions" | "Book Notes" | "Highlights" | "Bookmarks" | "AI Study" | "Reading Progress";

export function openMathsEbook(destination: MathsEbookDestination = "Reader") {
  try {
    sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: "maths-pt1", destination }));
  } catch { /* navigation still works when session storage is unavailable */ }
  navigateTo("ebook");
}
