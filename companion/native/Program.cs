using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// A per-user broker. The companion supplies workspace identities; native operations
// only touch handles proven by a fresh title challenge AND a per-window Win32 property.
class Program {
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct Placement {
        public int length, flags, showCmd; public Point min, max; public Rect normal;
    }
    public class Entry {
        public string key, cookie, session;
        public long hwnd, beat;
        public int pid;
        public bool hidden;
    }
    public class Journal { public int pid; public long started; public List<Entry> entries; }
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int command);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h, int command);
    [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr h, ref Placement p);
    [DllImport("user32.dll")] static extern bool SetWindowPlacement(IntPtr h, ref Placement p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool SetProp(IntPtr h, string name, IntPtr value);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetProp(IntPtr h, string name);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr RemoveProp(IntPtr h, string name);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    static JavaScriptSerializer json = new JavaScriptSerializer();
    static Dictionary<string,Entry> entries = new Dictionary<string,Entry>();
    static string statePath, active, transaction, destination;
    static long transactionTime;
    static bool enabled;
    static long Now { get { return DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond; } }
    static IntPtr H(Entry e) { return new IntPtr(e.hwnd); }
    static string Str(Dictionary<string,object> r, string k) { return r.ContainsKey(k) ? Convert.ToString(r[k]) : ""; }
    static bool Valid(Entry e) {
        if (e == null || !IsWindow(H(e)) || GetProp(H(e), e.cookie) != new IntPtr(1)) return false;
        int pid; GetWindowThreadProcessId(H(e), out pid); return pid == e.pid;
    }
    static bool CodeWindow(IntPtr h) {
        int pid; GetWindowThreadProcessId(h, out pid);
        var cls = new StringBuilder(256); GetClassName(h, cls, cls.Capacity);
        try { return cls.ToString() == "Chrome_WidgetWin_1" && Process.GetProcessById(pid).ProcessName == "Code"; }
        catch { return false; }
    }
    static Placement Position(IntPtr h) {
        var p = new Placement(); p.length = Marshal.SizeOf(p);
        if (!GetWindowPlacement(h, ref p)) throw new Exception("Cannot read window placement");
        return p;
    }
    static void Save() {
        var p = Process.GetCurrentProcess();
        var data = json.Serialize(new Journal { pid=p.Id, started=p.StartTime.ToUniversalTime().Ticks, entries=entries.Values.ToList() });
        var temp = statePath + ".tmp";
        File.WriteAllText(temp, data);
        if (File.Exists(statePath)) File.Replace(temp, statePath, null); else File.Move(temp, statePath);
    }
    static void Reveal(Entry e) {
        if (!Valid(e)) return;
        // SW_SHOWNOACTIVATE preserves maximization and avoids stealing recovery focus.
        ShowWindowAsync(H(e), 8);
        e.hidden = false;
    }
    static void ShowAll() {
        foreach (var e in entries.Values) if (e.hidden) Reveal(e);
        enabled=false; active=null; transaction=null; destination=null; Save();
    }
    static void Recover(string path) {
        if (!File.Exists(path)) return;
        var journal=json.Deserialize<Journal>(File.ReadAllText(path));
        foreach (var e in journal.entries) if (e.hidden) Reveal(e);
    }
    static void StopAndRecover(string path) {
        if (!File.Exists(path)) return;
        var journal=json.Deserialize<Journal>(File.ReadAllText(path));
        try {
            var broker=Process.GetProcessById(journal.pid);
            if (broker.StartTime.ToUniversalTime().Ticks==journal.started && broker.ProcessName==Process.GetCurrentProcess().ProcessName) {
                broker.Kill(); broker.WaitForExit(2000);
            }
        } catch (ArgumentException) {} catch (InvalidOperationException) {}
        Recover(path);
    }
    static void Watch(string path, int pid, long start) {
        while (true) {
            Thread.Sleep(1000);
            bool alive=false;
            try { var p=Process.GetProcessById(pid); alive=p.StartTime.ToUniversalTime().Ticks == start && !p.HasExited; } catch {}
            bool stale=File.Exists(path) && (DateTime.UtcNow-File.GetLastWriteTimeUtc(path)).TotalSeconds > 15;
            if (!alive || stale) {
                // Stop a hung broker before restoring, so it cannot hide again after recovery.
                if (alive) { try { Process.GetProcessById(pid).Kill(); } catch {} }
                try {
                    var current=json.Deserialize<Journal>(File.ReadAllText(path));
                    if(current.pid==pid && current.started==start) Recover(path);
                } catch {}
                return;
            }
        }
    }
    static void Sweep() {
        if (transaction != null && Now-transactionTime > 8000) ShowAll();
        if (active != null && (!entries.ContainsKey(active) || !Valid(entries[active]))) ShowAll();
        if (entries.Values.Any(e => e.hidden && (!Valid(e) || Now-e.beat > 12000))) ShowAll();
    }
    static object Commit(string token) {
        if (!enabled || transaction == null || token != transaction) throw new Exception("Expired switch; all windows remain accessible");
        var e=entries[destination];
        if (!Valid(e) || !IsWindowVisible(H(e)) || IsIconic(H(e)) || GetForegroundWindow()!=H(e)) {
            ShowAll(); throw new Exception("Windows did not give the destination focus; restored project windows");
        }
        // Journal every potentially hidden handle BEFORE hiding any. A separate watchdog
        // can recover even if this process is killed between two native calls.
        foreach(var other in entries.Values) other.hidden=other.key!=e.key && Valid(other);
        Save();
        foreach(var other in entries.Values) {
            if (!other.hidden) continue;
            if (GetForegroundWindow()!=H(e) || !IsWindowVisible(H(e)) || !IsWindowEnabled(H(other))) {
                ShowAll(); throw new Exception("Focus changed or a project has a modal dialog; restored project windows");
            }
            ShowWindow(H(other), 0);
            if (IsWindowVisible(H(other))) { ShowAll(); throw new Exception("Could not hide a registered window"); }
        }
        active=e.key; transaction=null; destination=null; Save();
        return new { ok=true, switched=true };
    }
    static object Handle(Dictionary<string,object> r) {
        Sweep();
        string op=Str(r,"op"), key=Str(r,"key"), session=Str(r,"session");
        if(op=="status") return new { ok=true, enabled=enabled, pid=Process.GetCurrentProcess().Id,
            entries=entries.Values.Select(e=>new {key=e.key,hwnd=e.hwnd,pid=e.pid,valid=Valid(e),visible=Valid(e)&&IsWindowVisible(H(e)),maximized=Valid(e)&&IsZoomed(H(e)),hidden=e.hidden}).ToArray() };
        if(op=="showAll") { ShowAll(); return new {ok=true}; }
        if(op=="enable") { enabled=true; Save(); return new {ok=true}; }
        if(op=="register") {
            string challenge=Str(r,"challenge");
            Guid nonce; if(!Guid.TryParseExact(challenge,"N",out nonce)) throw new Exception("Invalid registration challenge");
            var matches=new List<IntPtr>();
            EnumWindows((h,l)=> { var s=new StringBuilder(32768); GetWindowText(h,s,s.Capacity);
                if(CodeWindow(h) && s.ToString().Contains("[FSP:"+challenge+"]")) matches.Add(h); return true; },IntPtr.Zero);
            if(matches.Count==0) return new {ok=true,pending=true};
            if(matches.Count!=1) throw new Exception("Window challenge must identify exactly one VS Code window");
            var hnd=matches[0];
            if(entries.ContainsKey(key) && Valid(entries[key]) && H(entries[key])!=hnd) throw new Exception("This workspace already has a registered live window");
            if(entries.Values.Any(e=>e.key!=key && Valid(e) && H(e)==hnd)) throw new Exception("Window already bound to another project");
            if(entries.ContainsKey(key) && Valid(entries[key])) RemoveProp(hnd,entries[key].cookie);
            int pid; GetWindowThreadProcessId(hnd,out pid);
            var entry=new Entry { key=key, session=session, hwnd=hnd.ToInt64(), pid=pid, cookie="FSP.SingleWindow."+Guid.NewGuid().ToString("N"), beat=Now };
            if(!SetProp(hnd,entry.cookie,new IntPtr(1))) throw new Exception("Could not bind native window property");
            entries[key]=entry; Save(); return new {ok=true,hwnd=entry.hwnd};
        }
        if(op=="beat") {
            if(!entries.ContainsKey(key) || entries[key].session!=session || !Valid(entries[key])) return new {ok=true,registered=false};
            entries[key].beat=Now; Save(); return new {ok=true,registered=true};
        }
        if(op=="unregister") {
            if(entries.ContainsKey(key) && entries[key].session==session) {
                ShowAll(); var e=entries[key]; if(Valid(e)) RemoveProp(H(e),e.cookie); entries.Remove(key); Save();
            }
            return new {ok=true};
        }
        if(op=="switch") {
            if(!enabled) return new {ok=true,disabled=true};
            if(transaction!=null) throw new Exception("Another project switch is in progress");
            if(!entries.ContainsKey(key) || !Valid(entries[key])) return new {ok=true,missing=true};
            var e=entries[key];
            var foreground=GetForegroundWindow();
            var previous=entries.Values.FirstOrDefault(x=>Valid(x) && H(x)==foreground);
            if(previous==null && active!=null && entries.ContainsKey(active) && Valid(entries[active])) previous=entries[active];
            if(previous!=null && previous.key!=key && IsWindowVisible(H(previous))) {
                var p=Position(H(previous)); p.showCmd=IsZoomed(H(previous)) ? 3 : 1; p.flags=0;
                if(!SetWindowPlacement(H(e),ref p)) throw new Exception("Cannot transfer window placement");
            }
            ShowWindow(H(e),IsZoomed(H(e)) ? 3 : 9);
            if(!IsWindowVisible(H(e))) throw new Exception("Destination failed to become visible");
            transaction=Guid.NewGuid().ToString("N"); destination=key; transactionTime=Now;
            SetForegroundWindow(H(e)); Save();
            if(GetForegroundWindow()==H(e)) return Commit(transaction);
            return new {ok=true,needsFocus=true,token=transaction};
        }
        if(op=="commit") return Commit(Str(r,"token"));
        throw new Exception("Unknown operation");
    }
    static int Main(string[] args) {
        try {
            SetProcessDpiAwarenessContext(new IntPtr(-4));
            if(args.Length==0) return 2;
            if(args[0]=="recover") { StopAndRecover(args[1]); return 0; }
            if(args[0]=="watch") { Watch(args[1],int.Parse(args[2]),long.Parse(args[3])); return 0; }
            string pipeName=args[1]; statePath=args[2];
            bool owned;
            using(var mutex=new Mutex(true,"Local\\"+pipeName,out owned)) {
                if(!owned) return 0;
                Directory.CreateDirectory(Path.GetDirectoryName(statePath));
                Recover(statePath); Save();
                var self=Process.GetCurrentProcess();
                using(var watchdog=Process.Start(new ProcessStartInfo(self.MainModule.FileName,"watch \""+statePath+"\" "+self.Id+" "+self.StartTime.ToUniversalTime().Ticks) {UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden})) {
                    var security=new PipeSecurity(); security.SetAccessRuleProtection(true,false);
                    security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User,PipeAccessRights.FullControl,AccessControlType.Allow));
                    while(true) {
                        using(var pipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,NamedPipeServerStream.MaxAllowedServerInstances,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,65536,65536,security)) {
                            var wait=pipe.BeginWaitForConnection(null,null);
                            while(!wait.AsyncWaitHandle.WaitOne(500)) { Sweep(); Save(); }
                            pipe.EndWaitForConnection(wait);
                            using(var reader=new StreamReader(pipe,new UTF8Encoding(false),false,4096,true))
                            using(var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true) {AutoFlush=true}) {
                                try {
                                    var read=reader.ReadLineAsync();
                                    if(!read.Wait(3000) || read.Result==null || read.Result.Length>65536) continue;
                                    writer.WriteLine(json.Serialize(Handle(json.Deserialize<Dictionary<string,object>>(read.Result))));
                                } catch(Exception ex) {
                                    ShowAll(); try { writer.WriteLine(json.Serialize(new {ok=false,error=ex.GetBaseException().Message})); } catch {}
                                }
                            }
                        }
                    }
                }
            }
        } catch { try { if(statePath!=null) Recover(statePath); } catch {} return 1; }
    }
}
