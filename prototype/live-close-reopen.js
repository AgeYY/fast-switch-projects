const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {request,ready}=require('./drive'),{Broker}=require('../companion/broker');
const root=path.join(__dirname,'results'),broker=new Broker(path.join(root,'User/globalStorage/zeyuanye.fast-switch-projects-windows'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function reopen(p){
    // Older fixture versions have no PID guard; neutralize their old close request.
    fs.writeFileSync(path.join(ready(p).directory,p+'.json'),JSON.stringify({id:'reopening-'+Date.now(),op:'state',targetPid:0}));
    const destination=ready(p).remote==='ssh-remote'?['--file-uri',ready(p).uri]:[path.join(root,'FSP-'+p+'.code-workspace')];
    cp.execFileSync(process.env.ComSpec,['/d','/c','code.cmd','--user-data-dir',root,'--extensions-dir',path.join(root,'extensions'),'--new-window',...destination],{windowsHide:true});
}
async function main(){
    const before=(await request('B',{op:'state'})).result;
    await request('B',{op:'setting',key:'files.hotExit',value:'onExitAndWindowClose'});
    await request('B',{op:'command',command:'fastSwitchProjects.windows.enable'});
    const active=await broker.request({op:'status'});assert.equal(active.enabled,true);
    const old=active.entries.find(e=>e.key.toLowerCase().endsWith('/fsp-b.code-workspace'));assert.equal(old.visible,true);
    await request('B',{op:'command',command:'workbench.action.closeWindow'},3000).catch(()=>{});
    let closed;
    for(let n=0;n<100;n++){
        await delay(100);closed=await broker.request({op:'status'});
        if(!closed.enabled && !closed.entries.some(e=>e.hwnd===old.hwnd&&e.valid))break;
    }
    assert.ok(!closed.entries.some(e=>e.hwnd===old.hwnd&&e.valid),'Closed native window disappeared');
    assert.equal(closed.enabled,false);assert.ok(closed.entries.every(e=>!e.valid||e.visible));
    reopen('B');let after,reopened;
    for(let n=0;n<240;n++){
        await delay(250);
        if(ready('B').pid===before.pid)continue;
        after=(await request('B',{op:'state'})).result;
        reopened=await broker.request({op:'status'});
        const entry=reopened.entries.find(e=>e.key===old.key);
        if(entry?.valid&&entry.hwnd!==old.hwnd)break;
    }
    assert.ok(after&&after.pid!==before.pid,'Reopened extension host is a new session');
    assert.deepEqual(after.tabs,before.tabs,'Unsaved fixture tab restored on reopening');
    const newEntry=reopened.entries.find(e=>e.key===old.key);assert.ok(newEntry.valid&&newEntry.hwnd!==old.hwnd);
    const report={date:new Date().toISOString(),before,after,closed,newEntry,old,passed:true};
    fs.writeFileSync(path.join(root,'live-'+(before.remote==='ssh-remote'?'remote-':'')+'close-reopen.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:true,oldHwnd:old.hwnd,newHwnd:newEntry.hwnd,oldExtensionHost:before.pid,newExtensionHost:after.pid,restoredTabs:after.tabs}));
    await request('A',{op:'setting',key:'fastSwitchProjects.singleWindow.enabled',value:false});
    // Cleanup only these disposable local fixtures before reusing the harness for SSH.
    if(before.remote!=='ssh-remote') await Promise.all('ABC'.split('').map(p=>request(p,{op:'command',command:'workbench.action.closeWindow'},3000).catch(()=>{})));
}
main().catch(async e=>{await broker.recover().catch(()=>{});console.error(e.stack);process.exitCode=1;});
