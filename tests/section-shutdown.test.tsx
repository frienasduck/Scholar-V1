import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionShutdown } from "../src/components/section-shutdown";
import { getSectionShutdown } from "../src/lib/section-availability";
import { musicDefaults, suspendStudyMusic, useMusicStore } from "../src/lib/music-store";
import { MUSIC_CATALOG } from "../src/lib/study-music/catalog";
import { emptyLibrary } from "../src/lib/study-music/model";

test("only the two paused sections and the public LAMTube alias resolve a notice", () => {
  expect(getSectionShutdown("lamtube")).toBe(getSectionShutdown("nigtube"));
  expect(getSectionShutdown("music")?.title).toBe("Study Music");
  for (const id of ["dashboard", "ebook", "focus", "plus", "exam-prep", "toString", "__proto__"]) {
    expect(getSectionShutdown(id)).toBeNull();
    expect(renderToStaticMarkup(<SectionShutdown viewId={id} />)).toBe("");
  }
});

for (const [viewId, title, medium, tone, alternative] of [
  ["nigtube", "LAMTube", "videos", "coral", "Explore E-Books"],
  ["music", "Study Music", "music", "violet", "Open Focus Timer"],
] as const) {
  test(`${title} notice keeps the Plus-card structure without suggesting an upgrade bypass`, () => {
    const html = renderToStaticMarkup(<SectionShutdown viewId={viewId} />);
    expect(html).toContain(`data-section-shutdown="${viewId}"`);
    expect(html).toContain(`data-tone="${tone}"`);
    expect(html).toContain(`${title} is taking a pause.`);
    expect(html).toContain(`Scholar is facing copyright issues with the ${medium}.`);
    expect(html).toContain(`We’ll try to bring ${title} back as soon as possible.`);
    expect(html).toContain("no confirmed return date");
    expect(html).toContain("saved Scholar data is not deleted");
    expect(html).toContain("Paused for all users, including Scholar Plus");
    expect(html).toContain("This is not a plan restriction");
    expect(html.match(/<li[ >]/g)).toHaveLength(3);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    expect(html).toContain(alternative);
    expect(html).toContain("Back to Scholar");
    expect(html).not.toContain("Explore Scholar Plus");
    expect(html).not.toMatch(/<(iframe|video|audio)\b/);
  });
}

test("the shell intercepts shutdown routes before guest or Plus locks and stops job polling", async () => {
  const shell = await Bun.file("src/components/app-shell.tsx").text();
  expect(shell).toContain('shutdown ? <SectionShutdown viewId={active} /> : guestMode');
  expect(shell).toContain('!getSectionShutdown("nigtube") && <LamTubeBackgroundJobs />');
});

test("the music owner and quick shortcut cannot bypass the shutdown", async () => {
  const widget = await Bun.file("src/components/views/music-widget.tsx").text();
  const shortcut = await Bun.file("src/components/study-music/quick-access.tsx").text();
  expect(widget).toContain('entitled && !getSectionShutdown("music")');
  expect(widget).toContain("if (!allowed) suspendStudyMusic()");
  expect(shortcut).toContain('access.has("study_music_ad_free") && !shutdown');
  expect(shortcut).toContain('viewId: "music"');
});

test("suspending music preserves songs, playlists, favorites, queue and playhead", () => {
  const previous = useMusicStore.getState();
  try {
    useMusicStore.setState({ ...musicDefaults(), library: emptyLibrary(), owner: "shutdown-test", hydrated: true });
    const state = useMusicStore.getState();
    const track = MUSIC_CATALOG[0];
    state.addSong(track); state.favorite(track.id); state.createPlaylist("Keep this", [track.id]);
    state.playTrack(track); state.setCurrentTime(42);
    state.startFocus(25, 5, { goal: "Study", subject: "Physics", chapter: "Motion", pauseMusicOnBreak: false });
    state.setDrawer("quick");
    const library = useMusicStore.getState().library;
    suspendStudyMusic();
    const stopped = useMusicStore.getState();
    expect(stopped.library).toBe(library);
    expect(stopped.queue[0].id).toBe(track.id);
    expect(stopped.currentTime).toBe(42);
    expect(stopped.isPlaying).toBe(false);
    expect(stopped.widgetVisible).toBe(false);
    expect(stopped.drawer).toBeNull();
    expect(stopped.ambienceEnabled).toBe(false);
    expect(stopped.focus?.paused).toBe(true);
  } finally {
    useMusicStore.setState(previous, true);
  }
});
