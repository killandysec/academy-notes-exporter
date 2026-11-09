const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'academy-notes-exporter.js'), 'utf8');
const fence = String.fromCharCode(96).repeat(3);

class Directory {
  constructor(name) { this.name = name; this.dirs = new Map(); this.files = new Map(); this.writes = new Map(); }
  async getDirectoryHandle(name, opts = {}) {
    if (!this.dirs.has(name)) { if (!opts.create) throw Object.assign(new Error('Not found'), {name:'NotFoundError'}); this.dirs.set(name, new Directory(name)); }
    return this.dirs.get(name);
  }
  async getFileHandle(name, opts = {}) {
    if (!this.files.has(name)) { if (!opts.create) throw Object.assign(new Error('Not found'), {name:'NotFoundError'}); this.files.set(name, ''); }
    const dir = this;
    return {
      getFile: async () => ({text: async () => String(dir.files.get(name))}),
      createWritable: async () => ({
        write: async value => { dir.files.set(name, value); dir.writes.set(name, (dir.writes.get(name) || 0) + 1); },
        close: async () => {}
      })
    };
  }
}

function fixture(options = {}) {
  const fields = {};
  for (const id of ['close','path','folder','assets','overwrite','export','export-path','status']) fields['academy-'+id] = {value:'',checked:false,disabled:false,textContent:''};
  fields['academy-path'].value = '123';
  fields['academy-folder'].value = 'Course Notes';
  const panel = {style:{},remove(){},querySelector: id => fields[id.slice(1)]};
  const vault = new Directory('Example vault');
  if (!options.wrongVault) vault.dirs.set('.obsidian',new Directory('.obsidian'));
  const calls = [];
  const endpoints = {
    '/api/v2/paths/123': {id:options.wrongPath ? 124 : 123, modules:[{id:7,name:'Example Module'},{id:8,name:'Locked Module',is_unlocked:false}]},
    '/api/v2/modules/7': {id:7,name:'Example Module',walkthrough_id:9},
    '/api/v2/modules/7/sections': [{id:71,title:'Introduction'},{id:72,title:'Practice'}],
    '/api/v2/sections/71': {content:'# Introduction\n\nLesson prose.\n\n'+fence+'md\n![code example](not-an-asset.png)\n'+fence+'\n\n![Diagram [one]](/storage/modules/7/chart(1).png)',questions:[{content:'Which value is shown?'}]},
    '/api/v2/sections/72': {content:'Practice prose with '+String.fromCharCode(96)+'inline code'+String.fromCharCode(96)+'.'},
    '/api/v2/walkthroughs/9': {instructions:'# Example Module\n\nModule reference.\n\n## Introduction\n\nWorked steps.\n\n![Step](/storage/walkthroughs/9/step.png)\n\n## Question 1\n\nAnswer {hidden}.\n\n## Practice\n\nPractice instructions.\n\n# Unmatched Topic\n\nKeep this reference material.'}
  };
  const window = {showDirectoryPicker:async () => vault};
  const sandbox = {
    window, location:{protocol:'https:',origin:'https://academy.example.test',pathname:'/app/module/7/section/71'},
    document:{createElement:()=>panel,body:{appendChild(){}},images:[{src:'https://assets.example.test/content/modules/7/visible.png'}]},
    DOMParser:class {parseFromString(value){return {body:{textContent:String(value).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&')}}}},
    URL, Blob, console:{info(){},error(){}},alert(){},
    fetch:async (url, opts) => {
      calls.push({url,opts});
      assert.equal(opts.credentials,'same-origin');
      if (String(url).startsWith('https://assets.example.test/')) return {ok:!options.imageDenied,status:options.imageDenied?403:200,headers:{get:()=> 'image/png'},blob:async()=>new Blob(['fake image'],{type:'image/png'})};
      if (!(url in endpoints)) return {ok:false,status:404,headers:{get:()=> 'application/json'}};
      return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({data:endpoints[url]})};
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.helpers={splitWalkthrough,embedWalkthrough,destinations,maskCode};})();'),sandbox);
  return {fields,vault,calls,sandbox,run:()=>fields['academy-export-path'].onclick()};
}

test('exports accessible lessons, questions, images, inline walkthroughs and fallback reference',async()=>{
  const f=fixture(); await f.run();
  const root=f.vault.dirs.get('Notes').dirs.get('Course Notes');
  const module=root.dirs.get('01 - Example Module');
  const intro=module.files.get('01 - Introduction.md');
  assert.match(intro,/Lesson prose/);
  assert.match(intro,/## Practice Questions/);
  assert.match(intro,/## Walkthrough/);
  assert.match(intro,/\{hidden\}/);
  assert.match(intro,/!\[code example\]\(not-an-asset.png\)/);
  assert.match(intro,/assets\/01-image-01.png/);
  assert.match(intro,/assets\/walkthrough-71-image-01.png/);
  assert.match(module.files.get('00 - Module Index.md'),/Keep this reference material/);
  assert.equal(module.files.get('Walkthrough.md'),undefined);
  assert.equal(module.dirs.get('assets').files.size,2);
  assert.equal(f.calls.some(x=>x.url==='/api/v2/modules/8'),false);
  assert.equal(f.sandbox.window.__academyNotesExportResult.totals.written,2);
  assert.equal(f.sandbox.window.__academyNotesExportResult.totals.locked,1);
});

test('reruns keep annotations and avoid duplicate walkthroughs; replacement refreshes source',async()=>{
  const f=fixture();await f.run();
  const module=f.vault.dirs.get('Notes').dirs.get('Course Notes').dirs.get('01 - Example Module');
  const name='01 - Introduction.md';
  module.files.set(name,module.files.get(name)+'\nPersonal annotation.');
  const before=module.files.get(name);await f.run();
  assert.equal(module.files.get(name),before);
  assert.equal((before.match(/## Walkthrough/g)||[]).length,1);
  f.fields['academy-overwrite'].checked=true;await f.run();
  assert.doesNotMatch(module.files.get(name),/Personal annotation/);
  assert.equal((module.files.get(name).match(/## Walkthrough/g)||[]).length,1);
});

test('failed images retain remote links and warnings',async()=>{
  const f=fixture({imageDenied:true});await f.run();
  const result=f.sandbox.window.__academyNotesExportResult;
  assert.equal(result.totals.images,0);
  assert.ok(result.warnings.some(x=>x.includes('Could not save image')));
});

test('wrong vault and wrong path fail before lesson export',async()=>{
  for(const option of [{wrongVault:true},{wrongPath:true}]) {
    const f=fixture(option);await f.run();
    assert.equal(f.calls.some(x=>x.url==='/api/v2/sections/71'),false);
    assert.match(f.fields['academy-status'].textContent,/vault root|different path ID/);
  }
});

test('walkthrough headings respect fences and ambiguous titles stay unassigned',()=>{
  const f=fixture();const h=f.sandbox.helpers;
  const lesson={id:1,title:'Lesson',filename:'01 - Lesson.md'};
  const split=h.splitWalkthrough('# Module\n## Lesson\nText\n'+fence+'bash\n# Fake heading\n'+fence+'\n## Question 1\nAnswer',[lesson],'Module',7);
  assert.equal(split.matched.size,1);
  assert.match([...split.matched.values()][0],/# Fake heading/);
  const ambiguous=h.splitWalkthrough('# Shared\nBody',[{id:1,title:'Shared'},{id:2,title:'Shared'}],'Module',7);
  assert.equal(ambiguous.matched.size,0);
  assert.match(ambiguous.reference,/Body/);
  assert.ok(ambiguous.uncertain.length);
});

test('Markdown image parsing balances labels/parentheses and ignores code',()=>{
  const f=fixture();const h=f.sandbox.helpers;
  const md='![Disk [64GB]](image(1).png)\n\n'+fence+'md\n![sample](fake.png)\n'+fence+'\n\n'+String.fromCharCode(96)+'![inline](fake.png)'+String.fromCharCode(96);
  const found=h.destinations(md);
  assert.equal(found.length,1);
  assert.equal(found[0].source,'image(1).png');
});
