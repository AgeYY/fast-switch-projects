const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {ensureEngine}=require('../engineSetup');
function fixture(t,{remote=false,existing,installError,remainsOld=false}={}){
    const bundle=fs.mkdtempSync(path.join(os.tmpdir(),'fsp-engine-'));t.after(()=>fs.rmSync(bundle,{recursive:true,force:true}));
    const content=Buffer.from('bundled test engine');fs.writeFileSync(path.join(bundle,'engine.vsix'),content);
    fs.writeFileSync(path.join(bundle,'engine.json'),JSON.stringify({id:'ZeyuanYe.fast-switch-projects',version:'1.5.4',sha256:crypto.createHash('sha256').update(content).digest('hex')}));
    let status=existing;const installs=[];
    const vscode={env:{remoteName:remote?'ssh-remote':undefined},ExtensionKind:{Workspace:2},ProgressLocation:{Notification:15},Uri:{file:filename=>({scheme:'file',fsPath:filename})},
        window:{withProgress:async(_,fn)=>fn()},commands:{
            getCommands:async()=>status?['fastSwitchProjects.engine.status']:[],
            executeCommand:async(command,...args)=>{
                if(command==='fastSwitchProjects.engine.status')return status;
                assert.equal(command,'workbench.extensions.installExtension');installs.push(args[0]);
                if(installError)throw Error(installError);
                if(!remainsOld)status={version:'1.5.4',kind:remote?2:1};
            },
        }};
    return {installs,bundle,run:()=>ensureEngine(vscode,bundle,{sleep:async()=>{}})};
}
test('one Windows package installs the bundled engine for a local workspace',async t=>{
    const f=fixture(t),result=await f.run();assert.equal(result.ready,true);assert.equal(result.installed,true);
    assert.deepEqual(f.installs,[{scheme:'file',fsPath:path.join(f.bundle,'engine.vsix')}]);
});
test('a local engine cannot satisfy remote setup; waits for the workspace host',async t=>{
    const f=fixture(t,{remote:true,existing:{version:'1.5.4',kind:1}});assert.equal((await f.run()).ready,true);assert.equal(f.installs.length,1);
});
test('already available newer engine is retained without installation',async t=>{
    const f=fixture(t,{remote:true,existing:{version:'1.6.0',kind:2}});assert.equal((await f.run()).installed,false);assert.equal(f.installs.length,0);
});
test('damaged bundle is rejected before installation',async t=>{
    const f=fixture(t);fs.writeFileSync(path.join(f.bundle,'engine.vsix'),'damaged');
    await assert.rejects(f.run(),/damaged/);assert.equal(f.installs.length,0);
});
test('installation failure is reported instead of claiming readiness',async t=>{
    const f=fixture(t,{installError:'Install blocked'});await assert.rejects(f.run(),/Install blocked/);assert.equal(f.installs.length,1);
});
test('upgrading an active old engine reports the need for reload',async t=>{
    const f=fixture(t,{existing:{version:'1.5.3',kind:2},remainsOld:true});assert.deepEqual(await f.run(),{ready:false,installed:true});
});
