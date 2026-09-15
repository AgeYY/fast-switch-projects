const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const {Broker}=require('../broker');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('native broker: three registrations, layout, exclusion, close, recovery and crash', {skip:process.platform!=='win32',timeout:60000},async()=>{
    const root=path.resolve(__dirname,'../../prototype/results/native-'+Date.now());fs.mkdirSync(root,{recursive:true});
    const csc=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    cp.execFileSync(csc,['/nologo','/target:winexe','/r:System.Windows.Forms.dll','/r:System.Web.Extensions.dll','/out:'+path.join(root,'Code.exe'),path.join(__dirname,'Fixture.cs')]);
    const fixture=cp.spawn(path.join(root,'Code.exe'),[root],{windowsHide:true,stdio:'ignore'});
    const broker=new Broker(path.join(root,'broker'));let helperPid,beats;
    const state=()=>JSON.parse(fs.readFileSync(path.join(root,'fixture-state.json'),'utf8'));
    async function command(op,index){fs.writeFileSync(path.join(root,'fixture-command.json'),JSON.stringify({id:Math.random(),op,index}));await delay(250);}
    async function switchTo(i){const start=performance.now();const r=await broker.request({op:'switch',key:'project-'+i});if(r.needsFocus){await command('focus',i);await broker.request({op:'commit',token:r.token});}return performance.now()-start;}
    const measurements=[];
    try {
        await delay(1000);helperPid=(await broker.start()).pid;
        for(let i=0;i<3;i++)await broker.request({op:'register',key:'project-'+i,session:'test-'+i,challenge:'abc'[i].repeat(32)});
        beats=setInterval(()=>{for(let i=0;i<3;i++)broker.request({op:'beat',key:'project-'+i,session:'test-'+i}).catch(()=>{});},1500);
        await command('focus',0);await broker.request({op:'enable'});
        await switchTo(0);await delay(150);
        assert.deepEqual(state().windows.map(w=>w.visible),[true,false,false,true]);
        await command('move',0);const before=state();
        measurements.push(await switchTo(1));await delay(150);
        assert.deepEqual(state().windows[1].rect,before.windows[0].rect);
        assert.deepEqual(state().windows.map(w=>w.visible),[false,true,false,true]);
        await command('maximize',1);measurements.push(await switchTo(2));await delay(150);
        assert.equal(state().windows[2].maximized,true);
        for(let n=0;n<15;n++)measurements.push(await switchTo(n%3));
        assert.ok(state().ticks>before.ticks,'fixture process continues while its windows are hidden');
        await broker.request({op:'showAll'});await delay(150);assert.ok(state().windows.every(w=>w.visible));
        await broker.request({op:'enable'});await switchTo(0);
        // Commit must refuse a token when focus belongs to an unrelated window.
        await assert.rejects(broker.request({op:'commit',token:'invalid'}));await delay(150);
        assert.ok(state().windows.every(w=>w.visible));
        await broker.request({op:'enable'});await switchTo(1);
        process.kill(helperPid);await delay(2200);
        assert.ok(state().windows.every(w=>w.visible),'independent watchdog recovers killed helper');
        helperPid=(await broker.start()).pid;
        for(let i=0;i<3;i++)await broker.request({op:'register',key:'project-'+i,session:'test-'+i,challenge:'abc'[i].repeat(32)});
        await broker.request({op:'enable'});await switchTo(0);
        clearInterval(beats);await delay(13500);
        assert.ok(state().windows.every(w=>w.visible),'expired client leases restore all hidden windows');
        for(let i=0;i<3;i++)await broker.request({op:'beat',key:'project-'+i,session:'test-'+i});
        await broker.request({op:'enable'});await switchTo(2);await command('close',2);await delay(900);
        assert.ok(state().windows.slice(0,2).every(w=>w.visible),'closing active window restores survivors');
        const sorted=measurements.slice().sort((a,b)=>a-b);
        const report={kind:'synthetic Win32 fixture, not VS Code',measurementsMs:measurements,medianMs:sorted[Math.floor(sorted.length/2)],assertions:'3 registered, unrelated excluded, normal geometry, maximized, show all, invalid commit recovery, killed helper watchdog, lease expiry, active close'};
        fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    } finally {
        clearInterval(beats);await broker.recover().catch(()=>{});
        if(helperPid)try{process.kill(helperPid);}catch{}
        await command('quit',0).catch(()=>{});fixture.kill();
    }
});
