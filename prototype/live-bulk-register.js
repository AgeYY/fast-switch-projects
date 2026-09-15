const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const {ready,request}=require('./drive'),{Broker}=require('../companion/broker');
const root=path.join(__dirname,'results'),broker=new Broker(path.join(root,'User/globalStorage/zeyuanye.fast-switch-projects-windows'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const probe=()=>JSON.parse(cp.execFileSync(path.join(root,'WindowProbe.exe'),{encoding:'utf8',windowsHide:true}));
async function live(p,previous){
    for(let n=0;n<180;n++){
        try{const f=ready(p);if(f.pid===previous)throw Error('old host');process.kill(f.pid,0);
            const state=(await request(p,{op:'state'},1500)).result;
            if(state.trusted&&state.remote==='ssh-remote')return state;
        }catch{}
        await pause(500);
    }throw Error('No trusted remote fixture '+p);
}
async function main(){
    const before={A:await live('A'),B:await live('B')};
    const initial=await broker.start();assert.equal(initial.entries.length,0,'Fixtures initially unregistered');
    const windows=probe();
    const result=await request('A',{op:'command',command:'fastSwitchProjects.action.slots.openAndRegisterAllListedProjects'},90000);
    assert.equal(result.result.registered,3);assert.deepEqual(result.result.pending,[]);assert.deepEqual(result.result.failed,[]);
    const after={};for(const p of 'ABC')after[p]=await live(p);
    const status=await broker.request({op:'status'});
    assert.equal(status.entries.length,3);assert.equal(status.enabled,false);
    assert.ok(status.entries.every(e=>e.valid&&e.visible));
    assert.equal(after.A.pid,before.A.pid);assert.equal(after.B.pid,before.B.pid);
    const nativeAfter=probe();for(const w of windows.windows.filter(w=>w.visible))assert.ok(nativeAfter.windows.find(v=>v.hwnd===w.hwnd)?.visible);
    // Verify persistent revocation in a reopened test window.
    const oldC=after.C;
    await request('C',{op:'command',command:'fastSwitchProjects.windows.unregister'});
    await request('C',{op:'command',command:'workbench.action.closeWindow'},3000).catch(()=>{});
    for(let n=0;n<50;n++){try{process.kill(oldC.pid,0);}catch{break;}await pause(100);}
    cp.execFileSync(process.env.ComSpec,['/d','/c','code.cmd','--user-data-dir',root,'--extensions-dir',path.join(root,'extensions'),'--new-window','--file-uri',oldC.uri],{windowsHide:true});
    const reopened=await live('C',oldC.pid);await pause(2300);
    const revoked=await broker.request({op:'status'});assert.equal(revoked.entries.length,2);
    const repeat=await request('A',{op:'command',command:'fastSwitchProjects.action.slots.openAndRegisterAllListedProjects'},90000);
    assert.equal(repeat.result.registered,3);
    const report={date:new Date().toISOString(),passed:true,before,after,result,status,reopened,revoked,repeat};
    fs.writeFileSync(path.join(root,'live-bulk-register.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:true,registered:3,existingWindowsPreserved:true,unrelatedVisibleWindowsPreserved:true,coldProjectOpened:true,revocationSurvivedReopen:true,commandMs:result.ms}));
    for(const p of 'ABC')await request(p,{op:'command',command:'fastSwitchProjects.windows.unregister'});
    await request('A',{op:'setting',key:'fastSwitchProjects.singleWindow.enabled',value:false});
    for(const p of 'CBA')await request(p,{op:'command',command:'workbench.action.closeWindow'},3000).catch(()=>{});
}
main().catch(async e=>{await broker.recover().catch(()=>{});console.error(e.stack);process.exitCode=1;});
