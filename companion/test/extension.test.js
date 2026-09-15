const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),path=require('path');
function fixture(initial=false,selection,options={}) {
    const approvals=options.approvals||new Map(); let tick;
    const messages=[];
    const callbacks=new Map(),values=new Map(),calls=[],native=[],settings={'window.title':'Original', 'fastSwitchProjects.singleWindow.enabled':initial};
    const project=options.uri||'file:///C:/test/A.code-workspace';
    const uri={scheme:project.split(':')[0],toString:()=>project};
    if(options.registered) values.set('registered',true);
    let onChange,mode=false,missing=false;
    const config=section=>({get:(k,f)=>settings[(section?section+'.':'')+k]??f,
        inspect:k=>({workspaceValue:settings[(section?section+'.':'')+k]}),
        update:async(k,v)=>{const full=(section?section+'.':'')+k;settings[full]=v;if(full==='fastSwitchProjects.singleWindow.enabled')onChange?.({affectsConfiguration:q=>q===full});}});
    const vscode={Uri:{parse:()=>uri},ConfigurationTarget:{Workspace:2,Global:1},workspace:{workspaceFile:uri,getConfiguration:config,onDidChangeConfiguration:fn=>{onChange=fn;return {dispose(){}};}},
        window:{state:{focused:true},createOutputChannel:()=>({appendLine(){},show(){},dispose(){}}),showWarningMessage:()=>new Promise(()=>{}),showInformationMessage:(...args)=>{messages.push(args);return Promise.resolve(selection);}},
        commands:{registerCommand:(k,fn)=>{callbacks.set(k,fn);return {dispose(){}};},executeCommand:async(...args)=>{calls.push(args);return true;}}};
    class Broker {async start() {return {};}async recover(){native.push({op:'showAll'});mode=false;}async request(r){native.push(r);if(r.op==='enable')mode=true;if(r.op==='status')return {enabled:mode,entries:[]};if(r.op==='switch')return !mode?{disabled:true}:missing?{missing:true}:{switched:true};return {ok:true};}}
    const ctx={globalStorageUri:{fsPath:'C:/fixture'},workspaceState:{get:k=>values.get(k),update:async(k,v)=>{values.set(k,v);}},subscriptions:[]};
    const sandbox={module:{exports:{}},require:n=>n==='vscode'?vscode:n==='./broker'?{Broker}:n==='./engineSetup'?{ensureEngine:async()=>({ready:true})}:n==='./registrations'?{Registrations:class {get(k){return approvals.get(k);}set(k,v){approvals.set(k,v);}}}:n==='./identity'?{identity:u=>u.toString(),targetUri:(_v,value)=>({scheme:value.split(':')[0],toString:()=>value})}:require(n),process:{platform:'win32'},performance,setTimeout,clearTimeout,setInterval:fn=>{tick=fn;return 0;},clearInterval};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension.js'),'utf8'),sandbox);
    return {api:sandbox.module.exports,ctx,values,calls,native,settings,config,messages,approvals,tick:()=>tick(),run:(name,...args)=>callbacks.get('fastSwitchProjects.windows.'+name)(...args),setMissing:()=>{missing=true;}};
}

test('unregistered enable explains setup without claiming failure or changing native mode',async()=>{
    const f=fixture();await f.api.activate(f.ctx);await f.run('enable');
    assert.match(f.messages[0][0],/Slots list saves projects/);
    assert.equal(f.messages[0][1],'Register This Window and Enable');
    assert.equal(f.native.length,0);assert.equal(f.values.get('registered'),undefined);
    assert.equal(f.settings['fastSwitchProjects.singleWindow.enabled'],false);
});

test('explicit setup action binds this window before enabling hiding',async()=>{
    const f=fixture(false,'Register This Window and Enable');await f.api.activate(f.ctx);await f.run('enable');
    assert.equal(f.values.get('registered'),true);assert.equal(f.settings['window.title'],'Original');
    const bound=f.native.findIndex(r=>r.op==='register'),enabled=f.native.findIndex(r=>r.op==='enable');
    assert.ok(bound>=0&&enabled>bound);assert.ok(f.native.some(r=>r.op==='switch'));
});
test('disabled companion lets existing project routing continue',async()=>{
    const f=fixture();await f.api.activate(f.ctx);assert.equal(await f.run('open','file:///x'),false);assert.equal(f.native.length,0);
});
test('registration restores title; enabled switching uses native broker',async()=>{
    const f=fixture();await f.api.activate(f.ctx);await f.run('register');assert.equal(f.settings['window.title'],'Original');
    assert.equal(f.values.get('registered'),true);await f.run('enable');await f.run('open','file:///x');
    assert.ok(f.native.some(r=>r.op==='register'));assert.ok(f.native.some(r=>r.op==='switch'));assert.equal(f.calls.length,0);
});
test('recovery and disabling bypass a pending cold-open operation',async()=>{
    const f=fixture();await f.api.activate(f.ctx);await f.run('register');await f.run('enable');f.setMissing();
    const opening=f.run('open','file:///x');await new Promise(r=>setTimeout(r,20));
    await f.run('showAll');await opening;
    assert.ok(f.calls.some(c=>c[0]==='vscode.openFolder'&&c[2].forceNewWindow===true));
    await f.config().update('fastSwitchProjects.singleWindow.enabled',false);
    assert.ok(f.native.filter(r=>r.op==='showAll').length>=2);
});
test('paused recovery opens in another window without re-enabling hiding',async()=>{
    const f=fixture(true);await f.api.activate(f.ctx);await f.run('open','file:///x');
    assert.equal(f.calls[0][2].forceNewWindow,true);assert.ok(!f.native.some(r=>r.op==='enable'));
});


test('bulk approval registers loaded and newly opened listed windows but excludes unrelated windows',async()=>{
    const approvals=new Map(),a='file:///C:/test/A.code-workspace',b='file:///C:/test/B.code-workspace',c='file:///C:/test/C.code-workspace';
    const source=fixture(false,undefined,{approvals,uri:a}),loaded=fixture(false,undefined,{approvals,uri:b});
    const unrelated=fixture(false,undefined,{approvals,uri:'file:///C:/other.code-workspace'});
    for(const f of [source,loaded,unrelated])await f.api.activate(f.ctx);
    const result=await source.run('prepareRegistration',[a,b,b,c]);
    assert.deepEqual(Array.from(result.keys),[a,b,c]);assert.equal(result.ok,true);
    await loaded.tick();await unrelated.tick();
    const cold=fixture(false,undefined,{approvals,uri:c});await cold.api.activate(cold.ctx);
    for(const f of [source,loaded,cold]){
        assert.equal(f.values.get('registered'),true);
        assert.ok(f.native.some(r=>r.op==='register'));assert.ok(!f.native.some(r=>r.op==='enable'));
    }
    assert.equal(unrelated.native.length,0);assert.equal(unrelated.values.get('registered'),undefined);
});

test('unregister revokes bulk approval across heartbeat and reopening even with old workspace state',async()=>{
    const approvals=new Map(),uri='file:///C:/test/A.code-workspace';approvals.set(uri,true);
    const f=fixture(false,undefined,{approvals,uri});await f.api.activate(f.ctx);await f.run('unregister');
    const count=f.native.filter(r=>r.op==='register').length;await f.tick();
    assert.equal(f.native.filter(r=>r.op==='register').length,count);assert.equal(approvals.get(uri),false);
    const reopened=fixture(false,undefined,{approvals,uri,registered:true});await reopened.api.activate(reopened.ctx);
    assert.equal(reopened.values.get('registered'),false);assert.equal(reopened.native.length,0);
});

test('bulk approval rejects unsupported URIs before changing registrations',async()=>{
    const f=fixture();await f.api.activate(f.ctx);
    await assert.rejects(f.run('prepareRegistration',['untitled:workspace']),/Save each project/);
    assert.equal(f.approvals.size,0);assert.equal(f.native.length,0);
});
