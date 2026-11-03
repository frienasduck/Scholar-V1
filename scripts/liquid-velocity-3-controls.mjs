// Mechanical opt-in only: preserve every existing handler, class and condition.
// Deliberately excludes assessment options, reading/flip surfaces and motion.button.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const rules=[
 ['src/components/views/practice.tsx','practice',['PracticeView','QuestionList','QuestionCard']],
 ['src/components/views/ebook.tsx','reader',['EBookView']],
 ['src/components/views/planner.tsx','planner',['PlannerView']],
 ['src/components/views/flashcards/Class11FlashcardsView.tsx','revision',['RevisionModeButton']],
 ['src/components/lam-widget.tsx','lam',['LamWidgetRuntime']],
 ['src/components/exam-ready/setup.tsx','exam',['SetupFlow','Segments']],
 ['src/components/exam-ready/workspace.tsx','exam',['Workspace']],
 ['src/components/exam-ready/classroom.tsx','exam',['Classroom']],
 ['src/components/exam-ready/teacher-panel.tsx','exam',['TeacherPanel']],
 ['src/components/exam-ready/study-tools.tsx','exam',['StudyTools']],
];
let patch='*** Begin Patch\n';const inventory=[];
for(const [file,family,owners] of rules){
 const source=readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),positions=[];
 function visit(node){if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(tree)==='button'&&!node.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)==='data-velocity-control')){
   let parent=node,owner='';while(parent){if(ts.isFunctionDeclaration(parent)&&parent.name){owner=parent.name.text;break;}parent=parent.parent;}
   const handler=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)==='onClick')?.getText(tree)||'';
   if(owners.includes(owner)&&!handler.includes('handleMCQSelect'))positions.push(node.tagName.end);
 }ts.forEachChild(node,visit);}visit(tree);
 if(!positions.length)continue;let updated=source;for(const pos of positions.sort((a,b)=>b-a))updated=updated.slice(0,pos)+` data-velocity-control="${family}"`+updated.slice(pos);
 const a=source.split(/\r?\n/),b=updated.split(/\r?\n/),changed=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed.push(i);
 const groups=[];for(const index of changed){if(!groups.length||index-groups.at(-1).at(-1)>5)groups.push([index]);else groups.at(-1).push(index);}
 patch+=`*** Update File: ${file}\n`;for(const group of groups){patch+='@@\n';for(let i=Math.max(0,group[0]-2);i<=Math.min(a.length-1,group.at(-1)+2);i++)patch+=a[i]===b[i]?` ${a[i]}\n`:`-${a[i]}\n+${b[i]}\n`;}
 inventory.push({file,family,count:positions.length,owners});
}
mkdirSync('test-artifacts/liquid-velocity-3',{recursive:true});writeFileSync('test-artifacts/liquid-velocity-3/control-migration.json',JSON.stringify(inventory,null,2));
process.stdout.write(patch+'*** End Patch\n');
