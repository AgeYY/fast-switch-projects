// Run with node --test prototype/open-listed-projects.test.js.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file,dependencies){
    const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
        compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
    }).outputText;
    const module={exports:{}};
    new Function('require','module','exports',source)(name=>{
        if(!(name in dependencies))throw Error('Unexpected import '+name);
        return dependencies[name];
    },module,module.exports);
    return module.exports;
}
const {collectListedProjects}=load('src/common/listedProjects.ts',{});
function fixture({paths=['/A','/B','/C'],current='/A',companion=true,fail,stopAfter}={}){
    const calls=[],messages=[],token={isCancellationRequested:false};
    const uri=value=>({scheme:'file',path:value,toString:()=>value});
    const vscode={ProgressLocation:{Notification:15},commands:{
        getCommands:async()=>companion?['fastSwitchProjects.windows.showAll']:[],
        executeCommand:async(command,...args)=>{
            calls.push({command,args});
            if(command==='vscode.openFolder'){
                if(args[0].path===fail)throw Error('unavailable');
                if(calls.filter(c=>c.command==='vscode.openFolder').length===stopAfter)token.isCancellationRequested=true;
            }
        },
    },window:{
        showInformationMessage:m=>messages.push(m),showWarningMessage:m=>messages.push(m),showErrorMessage:m=>messages.push(m),
        withProgress:async(options,fn)=>{assert.equal(options.cancellable,true);return fn({report:()=>{}},token);},
    }};
    const {openListedProjects}=load('src/commands/openListedProjects.ts',{
        vscode,'../common/listedProjects':{collectListedProjects},'../common/uris':{createUri:uri},
        '../common/workspaces':{getCurrentWorkspacePath:()=>current},
    });
    const slots={refresh:()=>{},get:()=>paths.map(p=>({path:p}))},tags={getById:()=>null};
    return {run:(register=false)=>openListedProjects(slots,tags,register),calls,messages,vscode};
}
test('collects sparse slots in order, expands live tags/groups, deduplicates paths and retains separate workspace files',()=>{
    const slots=[];
    slots[1]={path:'/A.code-workspace'};slots[3]={groupId:1,paths:['/A.code-workspace','/B.code-workspace']};
    slots[5]={tagId:2,paths:['/stale']};slots[6]={tagId:99};slots[7]={path:''};
    assert.deepEqual(collectListedProjects(slots,id=>id===2?['/C','/B.code-workspace']:undefined),['/A.code-workspace','/B.code-workspace','/C']);
});
test('pauses hiding before opening unique destinations; preserves current window',async()=>{
    const f=fixture({paths:['/A','/B','/B','/C']});
    const result=await f.run();assert.equal(result.opened,2);
    assert.equal(f.calls[0].command,'fastSwitchProjects.windows.showAll');
    assert.deepEqual(f.calls.slice(1).map(c=>[c.args[0].path,c.args[1]]),[['/B',{forceNewWindow:true}],['/C',{forceNewWindow:true}]]);
});
test('works without companion and does not register projects',async()=>{
    const f=fixture({companion:false});await f.run();
    assert.ok(f.calls.every(c=>c.command==='vscode.openFolder'));
});
test('continues after one destination fails and reports it',async()=>{
    const f=fixture({fail:'/B'});const r=await f.run();
    assert.equal(r.opened,1);assert.deepEqual(r.failed,['/B: unavailable']);assert.match(f.messages[0],/Could not open/);
});
test('cancellation stops launching further destinations',async()=>{
    const f=fixture({stopAfter:1});const r=await f.run();assert.equal(r.opened,1);assert.equal(r.cancelled,true);
});
test('empty list provides feedback without opening or recovering windows',async()=>{
    const f=fixture({paths:[]});await f.run();assert.deepEqual(f.calls,[]);assert.match(f.messages[0],/No projects/);
});
test('a second invocation cannot start another batch while the first is running',async()=>{
    const f=fixture();let release;
    f.vscode.commands.getCommands=()=>new Promise(resolve=>{release=resolve;});
    const first=f.run();await f.run();assert.match(f.messages[0],/already running/);
    release([]);await first;assert.equal(f.calls.length,2);
});


test('bulk registration requires new companion and does not open anything when missing',async()=>{
    const f=fixture();await f.run(true);assert.equal(f.calls.length,0);assert.match(f.messages[0],/Companion 0.1.2/);
});

test('approves exactly the listed URIs including the current project, then confirms native registration',async()=>{
    const f=fixture({paths:['/A','/B','/B','/C']});
    f.vscode.commands.getCommands=async()=>['fastSwitchProjects.windows.prepareRegistration','fastSwitchProjects.windows.registrationStatus'];
    const original=f.vscode.commands.executeCommand;let prepared;
    f.vscode.commands.executeCommand=async(command,...args)=>{
        if(command.endsWith('prepareRegistration')){prepared=args[0];return {ok:true,keys:prepared};}
        if(command.endsWith('registrationStatus'))return {keys:prepared};
        assert.ok(prepared,'Approval precedes opening');return original(command,...args);
    };
    const result=await f.run(true);
    assert.deepEqual(prepared,['/A','/B','/C']);assert.equal(result.registered,3);assert.deepEqual(result.pending,[]);
    assert.equal(result.opened,2);assert.match(f.messages[0],/Enable Single Visible Window Mode/);
});

test('cancelled bulk setup reports pending registrations instead of claiming completion',async()=>{
    const f=fixture({stopAfter:1});
    f.vscode.commands.getCommands=async()=>['fastSwitchProjects.windows.prepareRegistration','fastSwitchProjects.windows.registrationStatus'];
    const original=f.vscode.commands.executeCommand;
    f.vscode.commands.executeCommand=async(command,...args)=>{
        if(command.endsWith('prepareRegistration'))return {ok:true,keys:args[0]};
        if(command.endsWith('registrationStatus'))return {keys:['/A']};
        return original(command,...args);
    };
    const result=await f.run(true);assert.equal(result.registered,1);assert.deepEqual(result.pending,['/B','/C']);
    assert.equal(result.cancelled,true);assert.match(f.messages[0],/Waiting for startup or workspace trust/);
});
