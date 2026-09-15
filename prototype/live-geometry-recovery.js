const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {request,ready}=require('./drive'),{Broker}=require('../companion/broker');
const broker=new Broker(path.join(__dirname,'results/User/globalStorage/zeyuanye.fast-switch-projects-windows'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const probe=()=>JSON.parse(cp.execFileSync(path.join(__dirname,'results/WindowProbe.exe'),{windowsHide:true,encoding:'utf8'}));
async function main(){
    const initial=await broker.request({op:'status'}),a=initial.entries.find(e=>e.key.toLowerCase().endsWith('/fsp-a.code-workspace'));
    let before;
    console.log('Waiting for FSP-A to be restored, resized and focused...');
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
        const native=probe(),window=native.windows.find(w=>w.hwnd===a.hwnd);
        if(window&&!window.maximized&&window.focused){before={...native,source:window};break;}
        await delay(300);
    }
    assert.ok(before,'No restored foreground window observed');
    // Allow the user to finish resizing/moving before taking the reference bounds.
    await delay(3000);before.source=probe().windows.find(w=>w.hwnd===a.hwnd);
    await request('A',{op:'command',command:'fastSwitchProjects.action.workspace.open',args:[{project:{path:ready('B').uri}}]});
    const status=await broker.request({op:'status'}),b=status.entries.find(e=>e.key.toLowerCase().endsWith('/fsp-b.code-workspace'));
    const after=probe(),destination=after.windows.find(w=>w.hwnd===b.hwnd);
    assert.equal(status.enabled,true);assert.equal(destination.focused,true);assert.equal(destination.maximized,false);
    assert.deepEqual(destination.rect,before.source.rect,'Exact restored native bounds transferred');
    for(const other of before.windows.filter(w=>!initial.entries.some(e=>e.hwnd===w.hwnd))){
        assert.equal(after.windows.find(w=>w.hwnd===other.hwnd)?.visible,other.visible,'Unrelated native visibility unchanged');
    }
    // Kill ONLY the broker identified by this disposable user-data directory.
    process.kill(status.pid);const killed=Date.now();let recovered;
    for(let n=0;n<50;n++){
        await delay(100);const observed=probe();
        if(initial.entries.every(e=>observed.windows.find(w=>w.hwnd===e.hwnd)?.visible)){recovered=Date.now()-killed;break;}
    }
    assert.ok(recovered,'Watchdog restored every real project window');
    await delay(2500);
    await request('A',{op:'command',command:'fastSwitchProjects.windows.showAll'});
    await request('A',{op:'setting',key:'fastSwitchProjects.singleWindow.enabled',value:false});
    const final=probe();assert.ok(initial.entries.every(e=>final.windows.find(w=>w.hwnd===e.hwnd)?.visible));
    const report={date:new Date().toISOString(),before,destination,watchdogRecoveryMs:recovered,final,passed:true};
    fs.writeFileSync(path.join(__dirname,'results/live-'+(ready('A').remote==='ssh-remote'?'remote-':'')+'geometry-recovery.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:true,monitors:before.monitors,bounds:destination.rect,watchdogRecoveryMs:recovered}));
}
main().catch(async e=>{await broker.recover().catch(()=>{});console.error(e.stack);process.exitCode=1;});
