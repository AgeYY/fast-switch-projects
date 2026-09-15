const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {request,ready}=require('./drive');
const {Broker}=require('../companion/broker');
const broker=new Broker(path.join(__dirname,'results/User/globalStorage/zeyuanye.fast-switch-projects-windows'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const key=p=>ready(p).uri.startsWith('file:')?ready(p).uri.toLowerCase():ready(p).uri;
async function main(){
    const limit=Date.now()+180000;
    let status;
    console.log('Waiting for a foreground Enable command and one visible project...');
    while(Date.now()<limit){
        status=await broker.request({op:'status'});
        if(status.enabled&&status.entries.filter(e=>e.visible).length===1)break;
        await delay(300);
    }
    assert.ok(status.enabled&&status.entries.filter(e=>e.visible).length===1,'Foreground enable was not observed');
    const before={};for(const p of 'ABC')before[p]=(await request(p,{op:'state'})).result;
    let current='ABC'.split('').find(p=>key(p)===status.entries.find(e=>e.visible).key);
    const samples=[];
    for(let n=0;n<30;n++){
        const target='ABC'[(n+1)%3];
        const result=await request(current,{op:'command',command:'fastSwitchProjects.action.workspace.open',args:[{project:{path:ready(target).uri}}]});
        status=await broker.request({op:'status'});
        const visible=status.entries.filter(e=>e.visible);
        assert.equal(status.enabled,true,'A switch paused hiding');
        assert.equal(visible.length,1,'Exactly one registered VS Code window is visible');
        assert.equal(visible[0].key,key(target));
        const state=(await request(target,{op:'state'})).result;
        assert.equal(state.focused,true,'Destination has focus according to VS Code');
        samples.push(result.ms);current=target;
    }
    const after={};for(const p of 'ABC'){
        after[p]=(await request(p,{op:'state'})).result;
        assert.equal(after[p].pid,before[p].pid,'Extension host stayed alive');
        assert.deepEqual(after[p].tabs,before[p].tabs,'Editor tabs and unsaved state survived');
        assert.deepEqual(after[p].terminals,before[p].terminals,'Terminal process and identity survived');
    }
    const sorted=samples.slice().sort((a,b)=>a-b);
    const remote=before.A.remote==='ssh-remote';
    const report={date:new Date().toISOString(),type:'real VS Code '+(remote?'Remote-SSH':'local')+' workspaces, public project-open command',before,after,samplesMs:samples,medianMs:sorted[15],p95Ms:sorted[28],maxMs:sorted[29],finalVisible:current,status};
    fs.writeFileSync(path.join(__dirname,'results/live-'+(remote?'remote':'local')+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:true,switches:30,medianMs:report.medianMs,p95Ms:report.p95Ms,maxMs:report.maxMs,finalVisible:current}));
}
main().catch(async error=>{await broker.recover().catch(()=>{});console.error(error.stack);process.exitCode=1;});
