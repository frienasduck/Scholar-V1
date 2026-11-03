import ts from 'typescript';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const out='test-artifacts/liquid-velocity-3'; await mkdir(out,{recursive:true});
const rows=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(file.endsWith('.tsx')){
  const source=await readFile(file,'utf8'), tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
    const tag=node.tagName.getText(tree); if(['button','motion.button','Button','GlassButton','TabsTrigger','Toggle','DropdownMenuTrigger','DialogTrigger'].includes(tag)){
      let parent=node, owner='module'; while(parent){if(ts.isFunctionDeclaration(parent)&&parent.name){owner=parent.name.text;break;}parent=parent.parent;}
      const attr=name=>node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)===name)?.getText(tree)||'';
      rows.push({file:file.replaceAll('\\','/'),line:tree.getLineAndCharacterOfPosition(node.getStart()).line+1,tag,owner,className:attr('className'),motionOwned:tag==='motion.button'||!!attr('whileTap')||!!attr('whileHover'),explicit:attr('data-velocity-control')});
    }
  }ts.forEachChild(node,visit);}visit(tree);
}}}
await walk('src/components');
await writeFile(out+'/control-inventory.json',JSON.stringify({native:rows.filter(r=>r.tag==='button').length,motionOwned:rows.filter(r=>r.motionOwned).length,total:rows.length,rows},null,2));
console.log(JSON.stringify({native:rows.filter(r=>r.tag==='button').length,motionOwned:rows.filter(r=>r.motionOwned).length,total:rows.length,priority:rows.filter(r=>/app-shell|exam-ready|lam-widget|views\/(notes|ebook|practice|planner|flashcards|resources|settings)|chapter-command\/workspace/.test(r.file)).map(r=>({file:r.file,line:r.line,owner:r.owner,className:r.className.slice(0,160),motionOwned:r.motionOwned}))},null,2));
