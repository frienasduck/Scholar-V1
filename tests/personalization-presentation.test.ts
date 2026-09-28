import { expect,test } from "bun:test";
import { BUILD_COPY,BUILD_VIDEO,CHAPTERS,SCHOLAR_SCENES,currentChapter,nextScholarScene } from "../src/components/personalization/personalization-presentation";

test("every saved question maps to a chapter without changing persisted stages",()=>{
  expect(currentChapter(0)).toBe(-1);
  for(let stage=1;stage<=11;stage++)expect(currentChapter(stage)).toBeGreaterThanOrEqual(0);
  expect(CHAPTERS[currentChapter(6)].label).toBe("LAM AI");
  expect(CHAPTERS[currentChapter(11)].label).toBe("Final touches");
});
test("build copy is driven by actual server stages and uses the exact requested asset",()=>{
  for(const stage of ["profile","priorities","materials","lam","strategy","dashboard"])expect(BUILD_COPY[stage]).toBeTruthy();
  expect(BUILD_VIDEO).toEndWith("hf_20260723_145606_ab143199-b593-4941-bb1b-9afca215416b.mp4");
});
test("the supplied scene clips and stills cycle in a reversible loop without a travel sequence",()=>{
  expect(SCHOLAR_SCENES.earth.video).toEndWith("hf_20260827_202422_3ffb4889-c520-432d-8458-038009eb40df.mp4");
  expect(SCHOLAR_SCENES.venus.video).toEndWith("hf_20260827_202422_b211cd74-013b-4dd3-bfd0-64491d8696fa.mp4");
  expect(SCHOLAR_SCENES.mars.video).toEndWith("hf_20260827_202422_51eae59a-2459-4c84-907c-cc5edfe5fea7.mp4");
  for(const scene of Object.values(SCHOLAR_SCENES))expect(scene.poster).toEndWith(".png");
  expect(nextScholarScene("earth")).toBe("venus");
  expect(nextScholarScene("venus")).toBe("mars");
  expect(nextScholarScene("mars")).toBe("earth");
});
